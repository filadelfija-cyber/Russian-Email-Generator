import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
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
  'ivanov',
  'smirnov',
  'kuznecov',
  'popov',
  'sokolov',
  'petrov',
  'volkov',
  'morozov',
  'novikov',
  'fedorov',
  'mikhailov',
  'orlov',
  'nikitin',
  'pavlov',
  'kozlov',
  'lebedev',
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

function randomItem<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function createAddress(domain: string, format: Format): Address {
  const surname = randomItem(SURNAMES);
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

function makeAddresses(domain: string, format: Format, count = 5) {
  const values: Address[] = [];
  const seen = new Set<string>();

  while (values.length < count) {
    const next = createAddress(domain, format);
    if (!seen.has(next.value)) {
      seen.add(next.value);
      values.push(next);
    }
  }

  return values;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [domain, setDomain] = useState<string>('mail.ru');
  const [format, setFormat] = useState<Format>('surname-first');
  const [addresses, setAddresses] = useState<Address[]>(() =>
    makeAddresses('mail.ru', 'surname-first'),
  );

  const featured = addresses[0];
  const formatLabel = useMemo(() => {
    if (format === 'name-first') return 'Name + surname';
    if (format === 'surname-number') return 'Surname + number';
    return 'Surname + name';
  }, [format]);

  const regenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddresses(makeAddresses(domain, format));
  };

  const updateDomain = (nextDomain: string) => {
    setDomain(nextDomain);
    setAddresses(makeAddresses(nextDomain, format));
    Haptics.selectionAsync();
  };

  const updateFormat = (nextFormat: Format) => {
    setFormat(nextFormat);
    setAddresses(makeAddresses(domain, nextFormat));
    Haptics.selectionAsync();
  };

  const shareAddress = async (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Share.share({
      message: value,
      title: 'Generated email address',
    });
  };

  const copyHint = () => {
    Alert.alert(
      'Generated example',
      'This is an example address. Use the share action to copy it to another app.',
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
                  accessibilityLabel={`Share ${featured.value}`}
                  onPress={() => shareAddress(featured.value)}
                  onLongPress={copyHint}
                  style={({ pressed }) => [
                    styles.shareButton,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Feather name="share-2" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.shareText, { color: colors.primaryForeground }]}>
                    Share
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
              NAME FORMAT
            </Text>
            <View style={[styles.formatControl, { backgroundColor: colors.secondary }]}>
              {([
                ['surname-first', 'Surname + name'],
                ['name-first', 'Name + surname'],
                ['surname-number', 'Surname + number'],
              ] as const).map(([value, label]) => {
                const selected = format === value;
                return (
                  <Pressable
                    key={value}
                    testID={`format-${value}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => updateFormat(value)}
                    style={[
                      styles.formatOption,
                      selected && { backgroundColor: colors.card },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.formatText,
                        { color: selected ? colors.foreground : colors.mutedForeground },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.listHeading}>
              <View>
                <Text style={[styles.listTitle, { color: colors.foreground }]}>
                  Fresh suggestions
                </Text>
                <Text style={[styles.listSubtitle, { color: colors.mutedForeground }]}>
                  {formatLabel} · {domain}
                </Text>
              </View>
              <Text style={[styles.count, { color: colors.accent }]}>05</Text>
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
              numberOfLines={1}
              style={[styles.addressText, { color: colors.foreground }]}
            >
              {item.value}
            </Text>
            <Pressable
              testID={`share-address-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Share ${item.value}`}
              onPress={() => shareAddress(item.value)}
              style={({ pressed }) => [styles.rowAction, { opacity: pressed ? 0.5 : 1 }]}
            >
              <Feather name="arrow-up-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            Generated locally on your device. These are examples, not active inboxes.
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