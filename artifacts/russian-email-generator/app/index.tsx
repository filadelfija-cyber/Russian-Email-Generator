import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type Format = {
  id: string;
  label: string;
  template: string;
  regex?: string;
  builtIn?: boolean;
};

type Address = {
  id: string;
  value: string;
  surname: string;
};

const DEFAULT_DOMAINS = ['mail.ru', 'yandex.ru', 'gmail.com', 'inbox.ru'] as const;

const DEFAULT_FORMATS: Format[] = [
  { id: 'surname-first', label: 'Surname + name', template: '{surname}.{name}', builtIn: true },
  { id: 'name-first', label: 'Name + surname', template: '{name}.{surname}', builtIn: true },
  { id: 'surname-number', label: 'Surname + number', template: '{surname}{number}', builtIn: true },
];

const SURNAMES = [
  { masculine: 'ivanov', feminine: 'ivanova' },
  { masculine: 'smirnov', feminine: 'smirnova' },
  { masculine: 'kuznecov', feminine: 'kuznecova' },
  { masculine: 'popov', feminine: 'popova' },
  { masculine: 'sokolov', feminine: 'sokolova' },
  { masculine: 'petrov', feminine: 'petrova' },
  { masculine: 'volkov', feminine: 'volkova' },
  { masculine: 'morozov', feminine: 'morozova' },
  { masculine: 'novikov', feminine: 'novikova' },
  { masculine: 'fedorov', feminine: 'fedorova' },
  { masculine: 'mikhailov', feminine: 'mikhailova' },
  { masculine: 'orlov', feminine: 'orlova' },
  { masculine: 'nikitin', feminine: 'nikitina' },
  { masculine: 'pavlov', feminine: 'pavlova' },
  { masculine: 'kozlov', feminine: 'kozlova' },
  { masculine: 'lebedev', feminine: 'lebedeva' },
] as const;

const NAMES = {
  masculine: [
    'alexey',
    'dmitry',
    'nikita',
    'maxim',
    'sergey',
    'artem',
    'ivan',
    'andrey',
    'mikhail',
  ],
  feminine: [
    'anna',
    'elena',
    'marina',
    'irina',
    'olga',
    'katya',
    'maria',
    'svetlana',
    'natalia',
  ],
} as const;

const QUANTITY_OPTIONS = [5, 25, 100, 500] as const;

function randomItem<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function createAddress(domain: string, format: Format): Address {
  const surnamePair = randomItem(SURNAMES);
  const feminine = Math.random() > 0.5;
  const surname = feminine ? surnamePair.feminine : surnamePair.masculine;
  const name = randomItem(feminine ? NAMES.feminine : NAMES.masculine);
  const number = Math.floor(10 + Math.random() * 90);
  const localPart = format.template
    .replace(/\{surname\}/gi, surname)
    .replace(/\{name\}/gi, name)
    .replace(/\{number\}/gi, String(number))
    .replace(/\{domain\}/gi, domain);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    value: `${localPart}@${domain}`,
    surname,
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileFormatRegex(pattern: string, domain: string) {
  if (!pattern.trim()) return { regex: null, error: null };

  const expanded = pattern
    .replace(/\{surname\}/gi, '[a-z]+')
    .replace(/\{name\}/gi, '[a-z]+')
    .replace(/\{number\}/gi, '\\d{1,3}')
    .replace(/\{domain\}/gi, escapeRegex(domain));

  try {
    return { regex: new RegExp(expanded), error: null };
  } catch {
    return {
      regex: null,
      error: 'That regex is not valid. Check brackets, slashes, and parentheses.',
    };
  }
}

function makeAddresses(domains: string[], formats: Format[], count = 5) {
  const values: Address[] = [];
  const seen = new Set<string>();
  let attempts = 0;

  if (domains.length === 0 || formats.length === 0) return values;

  while (values.length < count && attempts < count * 100) {
    const domain = domains[attempts % domains.length];
    const format = formats[attempts % formats.length];
    const compiled = compileFormatRegex(format.regex ?? '', domain);
    const next = createAddress(domain, format);
    attempts += 1;

    if (
      compiled.regex &&
      !compiled.regex.test(next.value) &&
      !compiled.regex.test(next.value.split('@')[0])
    ) {
      continue;
    }

    let value = next.value;
    let suffix = 1;
    while (seen.has(value)) {
      const [localPart, addressDomain] = next.value.split('@');
      value = `${localPart}.${suffix}@${addressDomain}`;
      suffix += 1;
    }
    seen.add(value);
    values.push({ ...next, value });
  }

  return values;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [domains, setDomains] = useState<string[]>([...DEFAULT_DOMAINS]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>(['mail.ru']);
  const [formats, setFormats] = useState<Format[]>(DEFAULT_FORMATS);
  const [selectedFormatIds, setSelectedFormatIds] = useState<string[]>(
    DEFAULT_FORMATS.map((format) => format.id),
  );
  const [quantity, setQuantity] = useState<number>(5);
  const [quantityInput, setQuantityInput] = useState<string>('5');
  const [formatDraft, setFormatDraft] = useState<string>('');
  const [regexDraft, setRegexDraft] = useState<string>('');
  const [domainDraft, setDomainDraft] = useState<string>('');
  const [showAddFormat, setShowAddFormat] = useState<boolean>(false);
  const [showAddDomain, setShowAddDomain] = useState<boolean>(false);
  const [addresses, setAddresses] = useState<Address[]>(() =>
    makeAddresses(['mail.ru'], DEFAULT_FORMATS),
  );

  const featured = addresses[0];
  const selectedFormats = useMemo(
    () => formats.filter((format) => selectedFormatIds.includes(format.id)),
    [formats, selectedFormatIds],
  );
  const draftRegexState = useMemo(
    () => compileFormatRegex(regexDraft, selectedDomains[0] ?? 'domain.com'),
    [regexDraft, selectedDomains],
  );
  const canGenerate = selectedDomains.length > 0 && selectedFormats.length > 0;

  const regenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddresses(makeAddresses(selectedDomains, selectedFormats, quantity));
  };

  const toggleDomain = (nextDomain: string) => {
    const nextSelected = selectedDomains.includes(nextDomain)
      ? selectedDomains.filter((item) => item !== nextDomain)
      : [...selectedDomains, nextDomain];
    setSelectedDomains(nextSelected);
    setAddresses(makeAddresses(nextSelected, selectedFormats, quantity));
    Haptics.selectionAsync();
  };

  const removeDomain = (domainToRemove: string) => {
    const nextDomains = domains.filter((item) => item !== domainToRemove);
    const nextSelected = selectedDomains.filter((item) => item !== domainToRemove);
    setDomains(nextDomains);
    setSelectedDomains(nextSelected);
    setAddresses(makeAddresses(nextSelected, selectedFormats, quantity));
  };

  const addDomain = () => {
    const nextDomain = domainDraft.trim().toLowerCase();
    const validDomain =
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
        nextDomain,
      );

    if (!validDomain) {
      Alert.alert('Check the domain', 'Enter a domain such as example.com.');
      return;
    }
    if (domains.includes(nextDomain)) {
      Alert.alert('Already added', `${nextDomain} is already in your domains.`);
      return;
    }

    const nextDomains = [...domains, nextDomain];
    const nextSelected = [...selectedDomains, nextDomain];
    setDomains(nextDomains);
    setSelectedDomains(nextSelected);
    setDomainDraft('');
    setShowAddDomain(false);
    setAddresses(makeAddresses(nextSelected, selectedFormats, quantity));
  };

  const toggleFormat = (formatId: string) => {
    const nextSelected = selectedFormatIds.includes(formatId)
      ? selectedFormatIds.filter((id) => id !== formatId)
      : [...selectedFormatIds, formatId];
    setSelectedFormatIds(nextSelected);
    const nextFormats = formats.filter((format) => nextSelected.includes(format.id));
    setAddresses(makeAddresses(selectedDomains, nextFormats, quantity));
    Haptics.selectionAsync();
  };

  const removeFormat = (formatId: string) => {
    const nextFormats = formats.filter((format) => format.id !== formatId);
    const nextSelectedIds = selectedFormatIds.filter((id) => id !== formatId);
    const nextSelectedFormats = nextFormats.filter((format) =>
      nextSelectedIds.includes(format.id),
    );
    setFormats(nextFormats);
    setSelectedFormatIds(nextSelectedIds);
    setAddresses(
      makeAddresses(selectedDomains, nextSelectedFormats, quantity),
    );
  };

  const addFormat = () => {
    const template = formatDraft.trim().toLowerCase();
    const validTemplate =
      template.length > 0 &&
      /^[a-z0-9._+{}-]+$/.test(template) &&
      /\{(?:surname|name|number)\}/.test(template);

    if (!validTemplate) {
      Alert.alert(
        'Check the format',
        'Use letters, dots, dashes, and tokens like {surname}.{name}.',
      );
      return;
    }
    if (draftRegexState.error) {
      Alert.alert('Check the regex', draftRegexState.error);
      return;
    }

    const newFormat: Format = {
      id: `custom-${Date.now()}`,
      label: `Custom · ${template}`,
      template,
      regex: regexDraft.trim() || undefined,
    };
    const nextFormats = [...formats, newFormat];
    const nextSelectedIds = [...selectedFormatIds, newFormat.id];
    setFormats(nextFormats);
    setSelectedFormatIds(nextSelectedIds);
    setFormatDraft('');
    setRegexDraft('');
    setShowAddFormat(false);
    setAddresses(
      makeAddresses(
        selectedDomains,
        nextFormats.filter((format) => nextSelectedIds.includes(format.id)),
        quantity,
      ),
    );
  };

  const updateQuantity = (nextQuantity: number) => {
    const safeQuantity = Math.min(500, Math.max(1, nextQuantity));
    setQuantity(safeQuantity);
    setQuantityInput(String(safeQuantity));
    setAddresses(makeAddresses(selectedDomains, selectedFormats, safeQuantity));
    Haptics.selectionAsync();
  };

  const applyTypedQuantity = () => {
    const parsed = Number.parseInt(quantityInput, 10);
    updateQuantity(Number.isNaN(parsed) ? 5 : parsed);
  };

  const copyText = async (value: string, message: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(value);
    Alert.alert('Copied', message);
  };

  const copyList = async () => {
    await copyText(
      addresses.map((address) => address.value).join('\n'),
      `${addresses.length} generated addresses are ready to paste.`,
    );
  };

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <StatusBar style="light" />
      <FlatList
        data={addresses.slice(1)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 24) + 12 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <View style={[styles.brandMark, { backgroundColor: colors.secondary }]}>
                <Feather name="at-sign" size={20} color={colors.primary} />
              </View>
              <View style={styles.eyebrowWrap}>
                <Text style={[styles.eyebrow, { color: colors.accent }]}>
                  ALIAS STUDIO
                </Text>
                <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                  Offline generator
                </Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: colors.accent }]} />
            </View>

            <Text style={[styles.title, { color: colors.foreground }]}>
              Make a Russian-style{'\n'}
              <Text style={{ color: colors.primary }}>email alias.</Text>
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Create believable sample addresses using common surnames and popular domains.
            </Text>

            <View style={[styles.featureCard, { backgroundColor: colors.card }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>
                  YOUR NEXT ADDRESS
                </Text>
                <Pressable
                  testID="regenerate-button"
                  accessibilityRole="button"
                  accessibilityLabel="Generate a new set of addresses"
                  onPress={regenerate}
                  style={({ pressed }) => [
                    styles.iconButton,
                    { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Feather name="refresh-cw" size={17} color={colors.foreground} />
                </Pressable>
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.featuredEmail, { color: colors.foreground }]}
              >
                {featured?.value ?? 'Select a format and domain'}
              </Text>
              <View style={styles.featureFooter}>
                <View style={styles.pill}>
                  <View style={[styles.pillDot, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.pillText, { color: colors.accent }]}>
                    {featured?.surname ?? 'No active selection'}
                  </Text>
                </View>
                <Pressable
                  testID="share-featured-button"
                  accessibilityRole="button"
                  accessibilityLabel={`Copy ${featured?.value ?? 'generated address'}`}
                  disabled={!featured}
                  onPress={() =>
                    featured &&
                    copyText(featured.value, 'The generated address is ready to paste.')
                  }
                  style={({ pressed }) => [
                    styles.shareButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: !featured ? 0.45 : pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Feather name="copy" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.shareText, { color: colors.primaryForeground }]}>
                    Copy
                  </Text>
                </Pressable>
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              DOMAINS TO USE
            </Text>
            <View style={styles.domainGrid}>
              {domains.map((item) => {
                const selected = selectedDomains.includes(item);
                return (
                  <View key={item} style={styles.managedOptionRow}>
                    <Pressable
                      testID={`domain-${item}`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => toggleDomain(item)}
                      style={({ pressed }) => [
                        styles.domainOption,
                        {
                          flex: 1,
                          backgroundColor: selected ? colors.primary : colors.secondary,
                          borderColor: selected ? colors.primary : colors.border,
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          {
                            backgroundColor: selected ? colors.primaryForeground : 'transparent',
                            borderColor: selected ? colors.primaryForeground : colors.border,
                          },
                        ]}
                      >
                        {selected ? (
                          <Feather name="check" size={12} color={colors.primary} />
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.domainText,
                          { color: selected ? colors.primaryForeground : colors.foreground },
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                    <Pressable
                      testID={`remove-domain-${item}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item}`}
                      onPress={() => removeDomain(item)}
                      style={({ pressed }) => [
                        styles.removeButton,
                        { opacity: pressed ? 0.5 : 1 },
                      ]}
                    >
                      <Feather name="trash-2" size={15} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
            {showAddDomain ? (
              <View style={styles.addRow}>
                <TextInput
                  testID="domain-input"
                  accessibilityLabel="New email domain"
                  value={domainDraft}
                  onChangeText={setDomainDraft}
                  onSubmitEditing={addDomain}
                  placeholder="example.com"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={[
                    styles.addInput,
                    { backgroundColor: colors.secondary, color: colors.foreground },
                  ]}
                />
                <Pressable
                  testID="confirm-add-domain-button"
                  accessibilityRole="button"
                  accessibilityLabel="Add domain"
                  onPress={addDomain}
                  style={({ pressed }) => [
                    styles.smallActionButton,
                    { backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Feather name="check" size={17} color={colors.accentForeground} />
                </Pressable>
              </View>
            ) : null}
            <Pressable
              testID="add-domain-button"
              accessibilityRole="button"
              accessibilityLabel="Add a domain"
              onPress={() => setShowAddDomain((visible) => !visible)}
              style={({ pressed }) => [styles.addItemButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name="plus" size={15} color={colors.accent} />
              <Text style={[styles.addItemText, { color: colors.accent }]}>
                {showAddDomain ? 'Close domain editor' : 'Add domain'}
              </Text>
            </Pressable>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              FORMATS TO USE
            </Text>
            <View style={styles.formatList}>
              {formats.map((format) => {
                const selected = selectedFormatIds.includes(format.id);
                return (
                  <View key={format.id} style={styles.managedOptionRow}>
                    <Pressable
                      testID={`format-${format.id}`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => toggleFormat(format.id)}
                      style={({ pressed }) => [
                        styles.formatOptionRow,
                        {
                          backgroundColor: selected ? colors.card : colors.secondary,
                          borderColor: selected ? colors.accent : colors.border,
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          {
                            backgroundColor: selected ? colors.accent : 'transparent',
                            borderColor: selected ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        {selected ? (
                          <Feather name="check" size={12} color={colors.accentForeground} />
                        ) : null}
                      </View>
                      <View style={styles.formatCopy}>
                        <Text style={[styles.formatName, { color: colors.foreground }]}>
                          {format.label}
                        </Text>
                        <Text style={[styles.formatTemplate, { color: colors.mutedForeground }]}>
                          {format.template}@domain
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      testID={`remove-format-${format.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${format.label}`}
                      onPress={() => removeFormat(format.id)}
                      style={({ pressed }) => [
                        styles.removeButton,
                        { opacity: pressed ? 0.5 : 1 },
                      ]}
                    >
                      <Feather name="trash-2" size={15} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
            {showAddFormat ? (
              <View style={styles.addFormatPanel}>
                <TextInput
                  testID="format-template-input"
                  accessibilityLabel="New email format template"
                  value={formatDraft}
                  onChangeText={setFormatDraft}
                  onSubmitEditing={addFormat}
                  placeholder="{surname}.{name}"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.addInput,
                    { backgroundColor: colors.secondary, color: colors.foreground },
                  ]}
                />
                <Text style={[styles.addHelp, { color: colors.mutedForeground }]}>
                  Use {'{surname}'}, {'{name}'}, or {'{number}'}.
                </Text>
                <TextInput
                  testID="format-regex-input"
                  accessibilityLabel="Regex filter for the new email format"
                  value={regexDraft}
                  onChangeText={setRegexDraft}
                  placeholder="Optional regex filter"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  style={[
                    styles.addInput,
                    { backgroundColor: colors.secondary, color: colors.foreground },
                  ]}
                />
                <Text
                  style={[
                    styles.addHelp,
                    {
                      color: draftRegexState.error
                        ? colors.destructive
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  {draftRegexState.error ??
                    'Regex is optional and filters this format only. Tokens: {surname}, {name}, {number}, {domain}.'}
                </Text>
                <Pressable
                  testID="confirm-add-format-button"
                  accessibilityRole="button"
                  accessibilityLabel="Add format"
                  onPress={addFormat}
                  style={({ pressed }) => [
                    styles.addConfirmButton,
                    { backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Feather name="plus" size={15} color={colors.accentForeground} />
                  <Text style={[styles.generateButtonText, { color: colors.accentForeground }]}>
                    Add format
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable
              testID="add-format-button"
              accessibilityRole="button"
              accessibilityLabel="Add a format"
              onPress={() => setShowAddFormat((visible) => !visible)}
              style={({ pressed }) => [styles.addItemButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name="plus" size={15} color={colors.accent} />
              <Text style={[styles.addItemText, { color: colors.accent }]}>
                {showAddFormat ? 'Close format editor' : 'Add format'}
              </Text>
            </Pressable>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              LIST SIZE
            </Text>
            <View style={styles.quantityRow}>
              <View style={[styles.quantityInputWrap, { backgroundColor: colors.secondary }]}>
                <TextInput
                  testID="quantity-input"
                  accessibilityLabel="Number of email addresses"
                  value={quantityInput}
                  onChangeText={(value) => setQuantityInput(value.replace(/[^0-9]/g, ''))}
                  onBlur={applyTypedQuantity}
                  onSubmitEditing={applyTypedQuantity}
                  keyboardType="number-pad"
                  maxLength={3}
                  selectTextOnFocus
                  style={[styles.quantityInput, { color: colors.foreground }]}
                />
                <Text style={[styles.quantityHint, { color: colors.mutedForeground }]}>
                  of 500
                </Text>
              </View>
              <Pressable
                testID="generate-list-button"
                accessibilityRole="button"
                accessibilityLabel={`Generate ${quantityInput || 5} addresses`}
                onPress={applyTypedQuantity}
                disabled={!canGenerate}
                style={({ pressed }) => [
                  styles.generateButton,
                  {
                    backgroundColor: colors.accent,
                    opacity: !canGenerate ? 0.45 : pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Feather name="zap" size={16} color={colors.accentForeground} />
                <Text style={[styles.generateButtonText, { color: colors.accentForeground }]}>
                  Generate
                </Text>
              </Pressable>
            </View>
            <View style={styles.quantityOptions}>
              {QUANTITY_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  testID={`quantity-${option}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: quantity === option }}
                  onPress={() => updateQuantity(option)}
                  style={({ pressed }) => [
                    styles.quantityOption,
                    {
                      backgroundColor:
                        quantity === option ? colors.card : colors.secondary,
                      borderColor: quantity === option ? colors.accent : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.quantityOptionText,
                      {
                        color:
                          quantity === option ? colors.accent : colors.mutedForeground,
                      },
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.listHeading}>
              <View>
                <Text style={[styles.listTitle, { color: colors.foreground }]}>
                  Fresh suggestions
                </Text>
                <Text style={[styles.listSubtitle, { color: colors.mutedForeground }]}>
                  Checked formats · {selectedDomains.length} domain
                  {selectedDomains.length === 1 ? '' : 's'} ·{' '}
                  {addresses.length} results
                </Text>
              </View>
              <Pressable
                testID="copy-list-button"
                accessibilityRole="button"
                accessibilityLabel={`Copy all ${addresses.length} generated addresses`}
                onPress={copyList}
                style={({ pressed }) => [
                  styles.copyListButton,
                  { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="copy" size={14} color={colors.accent} />
                <Text style={[styles.copyListText, { color: colors.accent }]}>Copy all</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={[styles.addressRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.rowNumber, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.rowNumberText, { color: colors.mutedForeground }]}>
                {String(index + 2).padStart(2, '0')}
              </Text>
            </View>
            <Text
              selectable
              numberOfLines={1}
              style={[styles.addressText, { color: colors.foreground }]}
            >
              {item.value}
            </Text>
            <Pressable
              testID={`share-address-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Copy ${item.value}`}
              onPress={() =>
                copyText(item.value, 'The generated address is ready to paste.')
              }
              style={({ pressed }) => [styles.rowAction, { opacity: pressed ? 0.5 : 1 }]}
            >
              <Feather name="copy" size={17} color={colors.mutedForeground} />
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            Generated locally on your device. These are examples, not active inboxes. Long-press an address to select it.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  brandMark: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderRadius: 14,
  },
  eyebrowWrap: {
    flex: 1,
    marginLeft: 12,
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1.7,
  },
  helper: {
    marginTop: 3,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 31,
    lineHeight: 37,
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 11,
    maxWidth: 340,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
  },
  featureCard: {
    marginTop: 25,
    padding: 18,
    borderRadius: 22,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 35,
    height: 35,
    borderRadius: 12,
  },
  featuredEmail: {
    marginTop: 25,
    fontFamily: 'Inter_700Bold',
    fontSize: 23,
    letterSpacing: -0.5,
  },
  featureFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 21,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 7,
  },
  pillText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 7,
  },
  shareText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  quantityInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  quantityInput: {
    minWidth: 32,
    paddingVertical: 0,
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
  quantityHint: {
    marginLeft: 7,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 15,
    borderRadius: 14,
    gap: 7,
  },
  generateButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  quantityOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 9,
  },
  quantityOption: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 47,
    minHeight: 34,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 11,
  },
  quantityOptionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  sectionLabel: {
    marginTop: 28,
    marginBottom: 11,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
  },
  domainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  domainOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 132,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 14,
    gap: 8,
  },
  domainText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  managedOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 5,
  },
  checkbox: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderWidth: 1,
    borderRadius: 5,
  },
  removeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 44,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 9,
    paddingVertical: 5,
    gap: 6,
  },
  addItemText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
    gap: 8,
  },
  addInput: {
    flex: 1,
    minHeight: 45,
    paddingHorizontal: 13,
    paddingVertical: 0,
    borderRadius: 13,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  smallActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 45,
    height: 45,
    borderRadius: 13,
  },
  formatList: {
    gap: 8,
  },
  formatOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 14,
  },
  formatCopy: {
    flex: 1,
    marginLeft: 10,
  },
  formatName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  formatTemplate: {
    marginTop: 3,
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
  addFormatPanel: {
    marginTop: 9,
    padding: 11,
    borderRadius: 14,
    gap: 8,
  },
  addHelp: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 15,
  },
  addConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 11,
    gap: 6,
  },
  formatControl: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    gap: 3,
  },
  formatOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 4,
    borderRadius: 11,
  },
  formatText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  patternInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 49,
    paddingHorizontal: 13,
    borderRadius: 14,
    gap: 9,
  },
  patternInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  clearPatternButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 32,
  },
  patternHint: {
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 31,
    marginBottom: 12,
  },
  listTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 19,
    letterSpacing: -0.3,
  },
  listSubtitle: {
    marginTop: 5,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  count: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
  },
  copyListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  copyListText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 63,
    borderBottomWidth: 1,
  },
  rowNumber: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 31,
    height: 31,
    borderRadius: 10,
  },
  rowNumberText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
  addressText: {
    flex: 1,
    marginLeft: 11,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  rowAction: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 42,
    marginLeft: 6,
  },
  disclaimer: {
    marginTop: 21,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
});