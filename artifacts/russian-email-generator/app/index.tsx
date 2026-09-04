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
import { useSendEmail } from '@workspace/api-client-react';
import type { SendEmailRequest } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

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

type Gender = 'masculine' | 'feminine';

type SurnamePair = {
  id: string;
  masculine: string;
  feminine: string;
};

type NamePool = {
  masculine: string[];
  feminine: string[];
};

const DEFAULT_DOMAINS = ['mail.ru', 'yandex.ru', 'gmail.com', 'inbox.ru'] as const;

const DEFAULT_FORMATS: Format[] = [
  { id: 'surname-first', label: 'Surname + name', template: '{surname}.{name}', builtIn: true },
  { id: 'name-first', label: 'Name + surname', template: '{name}.{surname}', builtIn: true },
  { id: 'surname-number', label: 'Surname + number', template: '{surname}{number}', builtIn: true },
];

const DEFAULT_SURNAMES: SurnamePair[] = [
  { id: 'ivanov-ivanova', masculine: 'ivanov', feminine: 'ivanova' },
  { id: 'smirnov-smirnova', masculine: 'smirnov', feminine: 'smirnova' },
  { id: 'kuznecov-kuznecova', masculine: 'kuznecov', feminine: 'kuznecova' },
  { id: 'popov-popova', masculine: 'popov', feminine: 'popova' },
  { id: 'sokolov-sokolova', masculine: 'sokolov', feminine: 'sokolova' },
  { id: 'petrov-petrova', masculine: 'petrov', feminine: 'petrova' },
  { id: 'volkov-volkova', masculine: 'volkov', feminine: 'volkova' },
  { id: 'morozov-morozova', masculine: 'morozov', feminine: 'morozova' },
  { id: 'novikov-novikova', masculine: 'novikov', feminine: 'novikova' },
  { id: 'fedorov-fedorova', masculine: 'fedorov', feminine: 'fedorova' },
  { id: 'mikhailov-mikhailova', masculine: 'mikhailov', feminine: 'mikhailova' },
  { id: 'orlov-orlova', masculine: 'orlov', feminine: 'orlova' },
  { id: 'nikitin-nikitina', masculine: 'nikitin', feminine: 'nikitina' },
  { id: 'pavlov-pavlova', masculine: 'pavlov', feminine: 'pavlova' },
  { id: 'kozlov-kozlova', masculine: 'kozlov', feminine: 'kozlova' },
  { id: 'lebedev-lebedeva', masculine: 'lebedev', feminine: 'lebedeva' },
];

const DEFAULT_NAMES: NamePool = {
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
};

const QUANTITY_OPTIONS = [5, 25, 100, 500] as const;

function randomItem<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function normalizeNamePool(pool: NamePool): NamePool {
  const seen = new Set<string>();
  const normalize = (items: string[]) =>
    items
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item && !seen.has(item))
      .filter((item) => {
        seen.add(item);
        return true;
      });

  return {
    masculine: normalize(pool.masculine),
    feminine: normalize(pool.feminine),
  };
}

function createAddress(
  domain: string,
  format: Format,
  surnames: SurnamePair[],
  names: NamePool,
): Address {
  const surnamePair = randomItem(surnames);
  const hasMasculineNames = names.masculine.length > 0;
  const hasFeminineNames = names.feminine.length > 0;
  const feminine =
    hasFeminineNames && (!hasMasculineNames || Math.random() > 0.5);
  const surname = feminine ? surnamePair.feminine : surnamePair.masculine;
  const name = randomItem(feminine ? names.feminine : names.masculine);
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

function makeAddresses(
  domains: string[],
  formats: Format[],
  surnames: SurnamePair[],
  names: NamePool,
  count = 5,
) {
  const values: Address[] = [];
  const seen = new Set<string>();
  let attempts = 0;

  if (
    domains.length === 0 ||
    formats.length === 0 ||
    surnames.length === 0 ||
    (names.masculine.length === 0 && names.feminine.length === 0)
  ) {
    return values;
  }

  while (values.length < count && attempts < count * 100) {
    const domain = domains[attempts % domains.length];
    const format = formats[attempts % formats.length];
    const compiled = compileFormatRegex(format.regex ?? '', domain);
    const next = createAddress(domain, format, surnames, names);
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
  const [surnamePairs, setSurnamePairs] = useState<SurnamePair[]>(DEFAULT_SURNAMES);
  const [namePool, setNamePool] = useState<NamePool>(() => normalizeNamePool(DEFAULT_NAMES));
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
  const [showNamePool, setShowNamePool] = useState<boolean>(false);
  const [showSurnamePool, setShowSurnamePool] = useState<boolean>(false);
  const [nameDraft, setNameDraft] = useState<string>('');
  const [nameGender, setNameGender] = useState<Gender>('masculine');
  const [surnameMasculineDraft, setSurnameMasculineDraft] = useState<string>('');
  const [surnameFeminineDraft, setSurnameFeminineDraft] = useState<string>('');
  const [showEmailSettings, setShowEmailSettings] = useState<boolean>(false);
  const [smtpHost, setSmtpHost] = useState<string>('');
  const [smtpPort, setSmtpPort] = useState<string>('587');
  const [smtpUsername, setSmtpUsername] = useState<string>('');
  const [smtpPassword, setSmtpPassword] = useState<string>('');
  const [smtpSecure, setSmtpSecure] = useState<boolean>(false);
  const [fromEmail, setFromEmail] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('Your generated email');
  const [emailBody, setEmailBody] = useState<string>(
    'Hello,\n\nThis is a sample message sent to a generated email address.',
  );
  const [addresses, setAddresses] = useState<Address[]>(() =>
    makeAddresses(['mail.ru'], DEFAULT_FORMATS, DEFAULT_SURNAMES, DEFAULT_NAMES),
  );
  const sendEmailMutation = useSendEmail();

  const featured = addresses[0];
  const selectedFormats = useMemo(
    () => formats.filter((format) => selectedFormatIds.includes(format.id)),
    [formats, selectedFormatIds],
  );
  const draftRegexState = useMemo(
    () => compileFormatRegex(regexDraft, selectedDomains[0] ?? 'domain.com'),
    [regexDraft, selectedDomains],
  );
  const canGenerate =
    selectedDomains.length > 0 &&
    selectedFormats.length > 0 &&
    surnamePairs.length > 0 &&
    (namePool.masculine.length > 0 || namePool.feminine.length > 0);

  const regenerateWith = (
    nextDomains = selectedDomains,
    nextFormats = selectedFormats,
    nextSurnames = surnamePairs,
    nextNames = namePool,
    nextQuantity = quantity,
  ) => {
    setAddresses(
      makeAddresses(nextDomains, nextFormats, nextSurnames, nextNames, nextQuantity),
    );
  };

  const regenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    regenerateWith();
  };

  const toggleDomain = (nextDomain: string) => {
    const nextSelected = selectedDomains.includes(nextDomain)
      ? selectedDomains.filter((item) => item !== nextDomain)
      : [...selectedDomains, nextDomain];
    setSelectedDomains(nextSelected);
    regenerateWith(nextSelected);
    Haptics.selectionAsync();
  };

  const removeDomain = (domainToRemove: string) => {
    const nextDomains = domains.filter((item) => item !== domainToRemove);
    const nextSelected = selectedDomains.filter((item) => item !== domainToRemove);
    setDomains(nextDomains);
    setSelectedDomains(nextSelected);
    regenerateWith(nextSelected);
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
    regenerateWith(nextSelected);
  };

  const toggleFormat = (formatId: string) => {
    const nextSelected = selectedFormatIds.includes(formatId)
      ? selectedFormatIds.filter((id) => id !== formatId)
      : [...selectedFormatIds, formatId];
    setSelectedFormatIds(nextSelected);
    const nextFormats = formats.filter((format) => nextSelected.includes(format.id));
    regenerateWith(selectedDomains, nextFormats);
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
    regenerateWith(selectedDomains, nextSelectedFormats);
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
    regenerateWith(
      selectedDomains,
      nextFormats.filter((format) => nextSelectedIds.includes(format.id)),
    );
  };

  const addName = () => {
    const name = nameDraft.trim().toLowerCase();
    if (!/^[a-z]+$/.test(name)) {
      Alert.alert('Check the name', 'Use letters only, such as alexey or anna.');
      return;
    }

    const normalizedPool = normalizeNamePool(namePool);
    if (
      normalizedPool.masculine.includes(name) ||
      normalizedPool.feminine.includes(name)
    ) {
      Alert.alert('Already added', `${name} already exists in the name pool.`);
      return;
    }

    const nextPool = normalizeNamePool({
      ...normalizedPool,
      [nameGender]: [...normalizedPool[nameGender], name],
    });
    setNamePool(nextPool);
    setNameDraft('');
    regenerateWith(selectedDomains, selectedFormats, surnamePairs, nextPool);
  };

  const removeName = (gender: Gender, nameToRemove: string) => {
    const nextPool = normalizeNamePool({
      ...namePool,
      [gender]: namePool[gender].filter((name) => name !== nameToRemove),
    });
    setNamePool(nextPool);
    regenerateWith(selectedDomains, selectedFormats, surnamePairs, nextPool);
  };

  const addSurnamePair = () => {
    const masculine = surnameMasculineDraft.trim().toLowerCase();
    const feminine = surnameFeminineDraft.trim().toLowerCase();
    if (!/^[a-z]+$/.test(masculine) || !/^[a-z]+$/.test(feminine)) {
      Alert.alert(
        'Check the surnames',
        'Use letters only and add both masculine and feminine forms.',
      );
      return;
    }
    if (
      surnamePairs.some(
        (pair) => pair.masculine === masculine || pair.feminine === feminine,
      )
    ) {
      Alert.alert('Already added', 'One of these surname forms is already in the pool.');
      return;
    }

    const nextPair: SurnamePair = {
      id: `${masculine}-${feminine}-${Date.now()}`,
      masculine,
      feminine,
    };
    const nextSurnames = [...surnamePairs, nextPair];
    setSurnamePairs(nextSurnames);
    setSurnameMasculineDraft('');
    setSurnameFeminineDraft('');
    regenerateWith(selectedDomains, selectedFormats, nextSurnames, namePool);
  };

  const removeSurnamePair = (pairId: string) => {
    const nextSurnames = surnamePairs.filter((pair) => pair.id !== pairId);
    setSurnamePairs(nextSurnames);
    regenerateWith(selectedDomains, selectedFormats, nextSurnames, namePool);
  };

  const updateQuantity = (nextQuantity: number) => {
    const safeQuantity = Math.min(500, Math.max(1, nextQuantity));
    setQuantity(safeQuantity);
    setQuantityInput(String(safeQuantity));
    regenerateWith(selectedDomains, selectedFormats, surnamePairs, namePool, safeQuantity);
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

  const sendGeneratedEmail = async () => {
    const port = Number.parseInt(smtpPort, 10);
    const recipients = addresses.map((address) => address.value);
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (recipients.length === 0) {
      Alert.alert('Nothing to send', 'Generate at least one address first.');
      return;
    }
    if (!smtpHost.trim() || !smtpUsername.trim() || !smtpPassword) {
      Alert.alert('Complete SMTP settings', 'Add the server, username, and password.');
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      Alert.alert('Check the SMTP port', 'Use a port between 1 and 65535.');
      return;
    }
    if (!emailPattern.test(fromEmail.trim())) {
      Alert.alert('Check the sender email', 'Enter a valid From email address.');
      return;
    }
    if (!emailSubject.trim() || !emailBody.trim()) {
      Alert.alert('Add a subject and body', 'Both fields are required before sending.');
      return;
    }

    const request: SendEmailRequest = {
      smtp: {
        host: smtpHost.trim(),
        port,
        username: smtpUsername.trim(),
        password: smtpPassword,
        secure: smtpSecure,
        fromEmail: fromEmail.trim(),
      },
      recipients,
      subject: emailSubject.trim(),
      body: emailBody.trim(),
    };

    try {
      const result = await sendEmailMutation.mutateAsync({ data: request });
      Alert.alert(
        'Email sent',
        `Sent to ${result.sent} generated address${result.sent === 1 ? '' : 'es'}.`,
      );
      setSmtpPassword('');
    } catch {
      Alert.alert(
        'Email could not be sent',
        'Check the SMTP server settings and credentials, then try again.',
      );
    }
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderScrollComponent={(props) => <KeyboardAwareScrollViewCompat {...props} />}
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
              NAME POOL
            </Text>
            <Pressable
              testID="name-pool-toggle"
              accessibilityRole="button"
              accessibilityLabel={`${showNamePool ? 'Close' : 'Open'} name pool`}
              onPress={() => setShowNamePool((visible) => !visible)}
              style={({ pressed }) => [
                styles.poolHeader,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View style={styles.poolHeaderCopy}>
                <Feather name="users" size={16} color={colors.accent} />
                <View style={styles.poolTitleWrap}>
                  <Text style={[styles.poolTitle, { color: colors.foreground }]}>
                    Names
                  </Text>
                  <Text style={[styles.poolSubtitle, { color: colors.mutedForeground }]}>
                    {namePool.masculine.length + namePool.feminine.length} total ·{' '}
                    {namePool.masculine.length} masculine · {namePool.feminine.length} feminine
                  </Text>
                </View>
              </View>
              <Feather
                name={showNamePool ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
            {showNamePool ? (
              <View style={[styles.poolPanel, { backgroundColor: colors.card }]}>
                <Text style={[styles.poolGroupLabel, { color: colors.mutedForeground }]}>
                  MASCULINE
                </Text>
                <View style={styles.poolChipWrap}>
                  {namePool.masculine.map((name) => (
                    <View
                      key={`masculine-${name}`}
                      style={[styles.poolChip, { backgroundColor: colors.secondary }]}
                    >
                      <Text style={[styles.poolChipText, { color: colors.foreground }]}>
                        {name}
                      </Text>
                      <Pressable
                        testID={`remove-masculine-name-${name}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove masculine name ${name}`}
                        onPress={() => removeName('masculine', name)}
                        style={styles.poolChipRemove}
                      >
                        <Feather name="x" size={12} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  ))}
                </View>
                <Text style={[styles.poolGroupLabel, { color: colors.mutedForeground }]}>
                  FEMININE
                </Text>
                <View style={styles.poolChipWrap}>
                  {namePool.feminine.map((name) => (
                    <View
                      key={`feminine-${name}`}
                      style={[styles.poolChip, { backgroundColor: colors.secondary }]}
                    >
                      <Text style={[styles.poolChipText, { color: colors.foreground }]}>
                        {name}
                      </Text>
                      <Pressable
                        testID={`remove-feminine-name-${name}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove feminine name ${name}`}
                        onPress={() => removeName('feminine', name)}
                        style={styles.poolChipRemove}
                      >
                        <Feather name="x" size={12} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  ))}
                </View>
                <View style={styles.poolGenderToggle}>
                  {(['masculine', 'feminine'] as const).map((gender) => (
                    <Pressable
                      key={gender}
                      testID={`name-gender-${gender}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: nameGender === gender }}
                      onPress={() => setNameGender(gender)}
                      style={[
                        styles.poolGenderOption,
                        {
                          backgroundColor:
                            nameGender === gender ? colors.accent : colors.secondary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.poolGenderText,
                          {
                            color:
                              nameGender === gender
                                ? colors.accentForeground
                                : colors.mutedForeground,
                          },
                        ]}
                      >
                        {gender === 'masculine' ? 'Masculine' : 'Feminine'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.addRow}>
                  <TextInput
                    testID="name-input"
                    accessibilityLabel={`New ${nameGender} name`}
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    onSubmitEditing={addName}
                    placeholder={nameGender === 'masculine' ? 'alexey' : 'anna'}
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                      styles.addInput,
                      { backgroundColor: colors.secondary, color: colors.foreground },
                    ]}
                  />
                  <Pressable
                    testID="add-name-button"
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${nameGender} name`}
                    onPress={addName}
                    style={({ pressed }) => [
                      styles.smallActionButton,
                      { backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather name="plus" size={17} color={colors.accentForeground} />
                  </Pressable>
                </View>
                <Text style={[styles.poolHelp, { color: colors.mutedForeground }]}>
                  Duplicate names are ignored so each name appears only once in its gender pool.
                </Text>
              </View>
            ) : null}

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              SURNAME POOL
            </Text>
            <Pressable
              testID="surname-pool-toggle"
              accessibilityRole="button"
              accessibilityLabel={`${showSurnamePool ? 'Close' : 'Open'} surname pool`}
              onPress={() => setShowSurnamePool((visible) => !visible)}
              style={({ pressed }) => [
                styles.poolHeader,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View style={styles.poolHeaderCopy}>
                <Feather name="book-open" size={16} color={colors.accent} />
                <View style={styles.poolTitleWrap}>
                  <Text style={[styles.poolTitle, { color: colors.foreground }]}>
                    Surnames
                  </Text>
                  <Text style={[styles.poolSubtitle, { color: colors.mutedForeground }]}>
                    {surnamePairs.length} masculine/feminine pairs
                  </Text>
                </View>
              </View>
              <Feather
                name={showSurnamePool ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
            {showSurnamePool ? (
              <View style={[styles.poolPanel, { backgroundColor: colors.card }]}>
                <View style={styles.surnamePairList}>
                  {surnamePairs.map((pair) => (
                    <View key={pair.id} style={styles.surnamePairRow}>
                      <View style={styles.surnamePairCopy}>
                        <Text style={[styles.surnamePairText, { color: colors.foreground }]}>
                          {pair.masculine}
                        </Text>
                        <Text style={[styles.surnamePairDivider, { color: colors.accent }]}>
                          /
                        </Text>
                        <Text style={[styles.surnamePairText, { color: colors.foreground }]}>
                          {pair.feminine}
                        </Text>
                      </View>
                      <Pressable
                        testID={`remove-surname-${pair.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove surname pair ${pair.masculine} and ${pair.feminine}`}
                        onPress={() => removeSurnamePair(pair.id)}
                        style={styles.poolChipRemove}
                      >
                        <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  ))}
                </View>
                <TextInput
                  testID="surname-masculine-input"
                  accessibilityLabel="New masculine surname"
                  value={surnameMasculineDraft}
                  onChangeText={setSurnameMasculineDraft}
                  placeholder="ivanov"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.addInput,
                    { backgroundColor: colors.secondary, color: colors.foreground },
                  ]}
                />
                <TextInput
                  testID="surname-feminine-input"
                  accessibilityLabel="New feminine surname"
                  value={surnameFeminineDraft}
                  onChangeText={setSurnameFeminineDraft}
                  placeholder="ivanova"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.addInput,
                    { backgroundColor: colors.secondary, color: colors.foreground },
                  ]}
                />
                <Pressable
                  testID="add-surname-button"
                  accessibilityRole="button"
                  accessibilityLabel="Add surname pair"
                  onPress={addSurnamePair}
                  style={({ pressed }) => [
                    styles.addConfirmButton,
                    { backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Feather name="plus" size={15} color={colors.accentForeground} />
                  <Text style={[styles.generateButtonText, { color: colors.accentForeground }]}>
                    Add surname pair
                  </Text>
                </Pressable>
              </View>
            ) : null}

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

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              SEND EMAIL
            </Text>
            <Pressable
              testID="email-settings-toggle"
              accessibilityRole="button"
              accessibilityLabel={`${showEmailSettings ? 'Close' : 'Open'} email sending settings`}
              onPress={() => setShowEmailSettings((visible) => !visible)}
              style={({ pressed }) => [
                styles.emailSettingsHeader,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View style={styles.emailSettingsTitleWrap}>
                <View style={[styles.emailIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name="send" size={16} color={colors.accent} />
                </View>
                <View style={styles.emailSettingsTitleCopy}>
                  <Text style={[styles.emailSettingsTitle, { color: colors.foreground }]}>
                    SMTP delivery
                  </Text>
                  <Text style={[styles.emailSettingsSubtitle, { color: colors.mutedForeground }]}>
                    {addresses.length} generated recipient{addresses.length === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
              <Feather
                name={showEmailSettings ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
            {showEmailSettings ? (
              <View style={[styles.emailSettingsPanel, { backgroundColor: colors.card }]}>
                <Text style={[styles.emailSecurityNote, { color: colors.mutedForeground }]}>
                  SMTP credentials are used for this send only and are not saved.
                </Text>
                <Text style={[styles.emailFieldLabel, { color: colors.mutedForeground }]}>
                  SMTP SERVER
                </Text>
                <TextInput
                  testID="smtp-host-input"
                  accessibilityLabel="SMTP server host"
                  value={smtpHost}
                  onChangeText={setSmtpHost}
                  placeholder="smtp.example.com"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.emailInput, { backgroundColor: colors.secondary, color: colors.foreground }]}
                />
                <View style={styles.emailFieldRow}>
                  <View style={styles.emailFieldGrow}>
                    <Text style={[styles.emailFieldLabel, { color: colors.mutedForeground }]}>
                      PORT
                    </Text>
                    <TextInput
                      testID="smtp-port-input"
                      accessibilityLabel="SMTP server port"
                      value={smtpPort}
                      onChangeText={(value) => setSmtpPort(value.replace(/[^0-9]/g, ''))}
                      placeholder="587"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                      style={[
                        styles.emailInput,
                        { backgroundColor: colors.secondary, color: colors.foreground },
                      ]}
                    />
                  </View>
                  <Pressable
                    testID="smtp-secure-toggle"
                    accessibilityRole="switch"
                    accessibilityState={{ checked: smtpSecure }}
                    accessibilityLabel="Use secure SMTP connection"
                    onPress={() => setSmtpSecure((secure) => !secure)}
                    style={({ pressed }) => [
                      styles.secureToggle,
                      {
                        backgroundColor: smtpSecure ? colors.accent : colors.secondary,
                        borderColor: smtpSecure ? colors.accent : colors.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name={smtpSecure ? 'lock' : 'unlock'}
                      size={15}
                      color={smtpSecure ? colors.accentForeground : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.secureToggleText,
                        { color: smtpSecure ? colors.accentForeground : colors.foreground },
                      ]}
                    >
                      Secure
                    </Text>
                  </Pressable>
                </View>
                <Text style={[styles.emailFieldLabel, { color: colors.mutedForeground }]}>
                  LOGIN
                </Text>
                <TextInput
                  testID="smtp-username-input"
                  accessibilityLabel="SMTP username"
                  value={smtpUsername}
                  onChangeText={setSmtpUsername}
                  placeholder="Username"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.emailInput, { backgroundColor: colors.secondary, color: colors.foreground }]}
                />
                <TextInput
                  testID="smtp-password-input"
                  accessibilityLabel="SMTP password"
                  value={smtpPassword}
                  onChangeText={setSmtpPassword}
                  placeholder="Password"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={[styles.emailInput, { backgroundColor: colors.secondary, color: colors.foreground }]}
                />
                <Text style={[styles.emailFieldLabel, { color: colors.mutedForeground }]}>
                  MESSAGE
                </Text>
                <TextInput
                  testID="from-email-input"
                  accessibilityLabel="From email address"
                  value={fromEmail}
                  onChangeText={setFromEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  style={[styles.emailInput, { backgroundColor: colors.secondary, color: colors.foreground }]}
                />
                <TextInput
                  testID="email-subject-input"
                  accessibilityLabel="Email subject"
                  value={emailSubject}
                  onChangeText={setEmailSubject}
                  placeholder="Subject"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.emailInput, { backgroundColor: colors.secondary, color: colors.foreground }]}
                />
                <TextInput
                  testID="email-body-input"
                  accessibilityLabel="Email body"
                  value={emailBody}
                  onChangeText={setEmailBody}
                  placeholder="Write your message"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  textAlignVertical="top"
                  style={[
                    styles.emailInput,
                    styles.emailBodyInput,
                    { backgroundColor: colors.secondary, color: colors.foreground },
                  ]}
                />
                <Pressable
                  testID="send-generated-email-button"
                  accessibilityRole="button"
                  accessibilityLabel={`Send email to ${addresses.length} generated recipients`}
                  onPress={sendGeneratedEmail}
                  disabled={sendEmailMutation.isPending || addresses.length === 0}
                  style={({ pressed }) => [
                    styles.sendEmailButton,
                    {
                      backgroundColor: colors.primary,
                      opacity:
                        sendEmailMutation.isPending || addresses.length === 0
                          ? 0.45
                          : pressed
                            ? 0.75
                            : 1,
                    },
                  ]}
                >
                  <Feather name="send" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.generateButtonText, { color: colors.primaryForeground }]}>
                    {sendEmailMutation.isPending
                      ? 'Sending…'
                      : `Send to ${addresses.length} generated`}
                  </Text>
                </Pressable>
              </View>
            ) : null}

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
  poolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 16,
  },
  poolHeaderCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  poolTitleWrap: {
    flex: 1,
  },
  poolTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  poolSubtitle: {
    marginTop: 3,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  poolPanel: {
    marginTop: 8,
    padding: 13,
    borderRadius: 16,
    gap: 9,
  },
  poolGroupLabel: {
    marginTop: 2,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
  },
  poolChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  poolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 31,
    paddingLeft: 10,
    paddingRight: 5,
    borderRadius: 10,
    gap: 3,
  },
  poolChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  poolChipRemove: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 25,
    height: 25,
  },
  poolGenderToggle: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 11,
    gap: 3,
  },
  poolGenderOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 35,
    borderRadius: 9,
  },
  poolGenderText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  poolHelp: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 15,
  },
  surnamePairList: {
    gap: 5,
  },
  surnamePairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 38,
    paddingLeft: 11,
    borderRadius: 10,
  },
  surnamePairCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  surnamePairText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  surnamePairDivider: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  emailSettingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 16,
  },
  emailSettingsTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emailIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 11,
  },
  emailSettingsTitleCopy: {
    flex: 1,
    marginLeft: 10,
  },
  emailSettingsTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  emailSettingsSubtitle: {
    marginTop: 3,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  emailSettingsPanel: {
    marginTop: 8,
    padding: 13,
    borderRadius: 16,
    gap: 9,
  },
  emailSecurityNote: {
    marginBottom: 3,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  emailFieldLabel: {
    marginTop: 3,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
  },
  emailInput: {
    minHeight: 45,
    paddingHorizontal: 13,
    paddingVertical: 0,
    borderRadius: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  emailBodyInput: {
    minHeight: 118,
    paddingTop: 12,
    paddingBottom: 12,
  },
  emailFieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
  },
  emailFieldGrow: {
    flex: 1,
    gap: 9,
  },
  secureToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 45,
    minWidth: 105,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    gap: 7,
  },
  secureToggleText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  sendEmailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 3,
    paddingHorizontal: 15,
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