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

type Format = 'surname-first' | 'name-first' | 'surname-number';

type Address = {
  id: string;
  value: string;
  surname: string;
};

const DOMAINS = ['mail.ru', 'yandex.ru', 'gmail.com', 'inbox.ru'] as const;

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

const NAMES = [
  'alexey',
  'dmitry',
  'nikita',
  'anna',
  'elena',
  'marina',
  'irina',
  'maxim',
  'sergey',
  'olga',
  'artem',
  'katya',
] as const;

const QUANTITY_OPTIONS = [5, 25, 100, 500] as const;
const ALL_FORMATS: readonly Format[] = [
  'surname-first',
  'name-first',
  'surname-number',
];

function randomItem<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function createAddress(domain: string, format: Format): Address {
  const surnamePair = randomItem(SURNAMES);
  const feminine = Math.random() > 0.5;
  const surname = feminine ? surnamePair.feminine : surnamePair.masculine;
  const name = randomItem(NAMES);
  const value =
    format === 'name-first'
      ? `${name}.${surname}@${domain}`
      : format === 'surname-number'
        ? `${surname}${Math.floor(10 + Math.random() * 90)}@${domain}`
        : `${surname}.${name}@${domain}`;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    value,
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

function makeAddresses(domain: string, pattern: string, count = 5) {
  const values: Address[] = [];
  const seen = new Set<string>();
  const compiled = compileFormatRegex(pattern, domain);
  let attempts = 0;

  while (values.length < count && attempts < count * 100) {
    const format = ALL_FORMATS[attempts % ALL_FORMATS.length];
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
  const [domain, setDomain] = useState<string>('mail.ru');
  const [quantity, setQuantity] = useState<number>(5);
  const [quantityInput, setQuantityInput] = useState<string>('5');
  const [formatPattern, setFormatPattern] = useState<string>('');
  const [addresses, setAddresses] = useState<Address[]>(() =>
    makeAddresses('mail.ru', ''),
  );

  const featured = addresses[0];
  const regexState = useMemo(
    () => compileFormatRegex(formatPattern, domain),
    [formatPattern, domain],
  );

  const regenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddresses(makeAddresses(domain, formatPattern, quantity));
  };

  const updateDomain = (nextDomain: string) => {
    setDomain(nextDomain);
    setAddresses(makeAddresses(nextDomain, formatPattern, quantity));
    Haptics.selectionAsync();
  };

  const updateQuantity = (nextQuantity: number) => {
    const safeQuantity = Math.min(500, Math.max(1, nextQuantity));
    setQuantity(safeQuantity);
    setQuantityInput(String(safeQuantity));
    setAddresses(makeAddresses(domain, formatPattern, safeQuantity));
    Haptics.selectionAsync();
  };

  const applyTypedQuantity = () => {
    const parsed = Number.parseInt(quantityInput, 10);
    updateQuantity(Number.isNaN(parsed) ? 5 : parsed);
  };

  const applyFormatPattern = () => {
    setAddresses(makeAddresses(domain, formatPattern, quantity));
    Haptics.selectionAsync();
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
                {featured.value}
              </Text>
              <View style={styles.featureFooter}>
                <View style={styles.pill}>
                  <View style={[styles.pillDot, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.pillText, { color: colors.accent }]}>
                    {featured.surname}
                  </Text>
                </View>
                <Pressable
                  testID="share-featured-button"
                  accessibilityRole="button"
                  accessibilityLabel={`Copy ${featured.value}`}
                  onPress={() =>
                    copyText(featured.value, 'The generated address is ready to paste.')
                  }
                  style={({ pressed }) => [
                    styles.shareButton,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
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
              CHOOSE A DOMAIN
            </Text>
            <View style={styles.domainGrid}>
              {DOMAINS.map((item) => {
                const selected = item === domain;
                return (
                  <Pressable
                    key={item}
                    testID={`domain-${item}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => updateDomain(item)}
                    style={({ pressed }) => [
                      styles.domainOption,
                      {
                        backgroundColor: selected ? colors.primary : colors.secondary,
                        borderColor: selected ? colors.primary : colors.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.domainText,
                        { color: selected ? colors.primaryForeground : colors.foreground },
                      ]}
                    >
                      {item}
                    </Text>
                    {selected ? (
                      <Feather name="check" size={15} color={colors.primaryForeground} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

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
                style={({ pressed }) => [
                  styles.generateButton,
                  { backgroundColor: colors.accent, opacity: pressed ? 0.75 : 1 },
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
              FORMAT REGEX
            </Text>
            <View style={[styles.patternInputWrap, { backgroundColor: colors.secondary }]}>
              <Feather name="code" size={16} color={colors.mutedForeground} />
              <TextInput
                testID="format-regex-input"
                accessibilityLabel="Custom email format regular expression"
                value={formatPattern}
                onChangeText={setFormatPattern}
                onSubmitEditing={applyFormatPattern}
                placeholder="^{surname}\\.{name}@{domain}$"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType="done"
                style={[styles.patternInput, { color: colors.foreground }]}
              />
              {formatPattern ? (
                <Pressable
                  testID="clear-format-regex-button"
                  accessibilityRole="button"
                  accessibilityLabel="Clear custom format regex"
                  onPress={() => {
                    setFormatPattern('');
                    setAddresses(makeAddresses(domain, '', quantity));
                  }}
                  style={styles.clearPatternButton}
                >
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
            <Text
              style={[
                styles.patternHint,
                { color: regexState.error ? colors.destructive : colors.mutedForeground },
              ]}
            >
              {regexState.error ??
                'Tokens: {surname}, {name}, {number}, {domain}. Leave blank to use all 3 formats.'}
            </Text>

            <View style={styles.listHeading}>
              <View>
                <Text style={[styles.listTitle, { color: colors.foreground }]}>
                  Fresh suggestions
                </Text>
                <Text style={[styles.listSubtitle, { color: colors.mutedForeground }]}>
                  {formatPattern ? 'Regex filtered' : 'All 3 formats'} · {domain} ·{' '}
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