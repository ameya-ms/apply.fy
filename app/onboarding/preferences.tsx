import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { useAppStore } from '../../store/appStore';
import type { JobType, RemoteType } from '../../types';

const SUGGESTED_ROLES = [
  'Software Engineer',
  'Frontend Engineer',
  'Backend Engineer',
  'Full Stack Engineer',
  'iOS Engineer',
  'Android Engineer',
  'DevOps Engineer',
  'Data Engineer',
  'ML Engineer',
  'Product Manager',
  'UX Designer',
  'QA Engineer',
];

const SUGGESTED_LOCATIONS = [
  'San Francisco, CA',
  'New York, NY',
  'Seattle, WA',
  'Austin, TX',
  'Boston, MA',
  'Los Angeles, CA',
  'Chicago, IL',
  'Remote',
];

const JOB_TYPES: { label: string; value: JobType }[] = [
  { label: 'Full-time', value: 'full-time' },
  { label: 'Part-time', value: 'part-time' },
  { label: 'Contract', value: 'contract' },
  { label: 'Internship', value: 'internship' },
];

const REMOTE_OPTIONS: { label: string; value: RemoteType | 'any'; emoji: string }[] = [
  { label: 'Any', value: 'any', emoji: '🌍' },
  { label: 'Remote Only', value: 'remote', emoji: '🏠' },
  { label: 'Hybrid', value: 'hybrid', emoji: '🔀' },
  { label: 'On-site', value: 'onsite', emoji: '🏢' },
];

export default function PreferencesOnboarding() {
  const { setSearchPreferences, setOnboarded, searchPreferences, userProfile } = useAppStore();

  const [roles, setRoles] = useState<string[]>(
    userProfile?.preferredRoles ?? searchPreferences.roles
  );
  const [locations, setLocations] = useState<string[]>(
    userProfile?.preferredLocations ?? searchPreferences.locations
  );
  const [jobTypes, setJobTypes] = useState<JobType[]>(searchPreferences.jobTypes);
  const [remote, setRemote] = useState<RemoteType | 'any'>(
    searchPreferences.remotePreference
  );
  const [roleInput, setRoleInput] = useState('');
  const [locationInput, setLocationInput] = useState('');

  const toggleItem = <T extends string>(arr: T[], item: T, setArr: (v: T[]) => void) => {
    if (arr.includes(item)) {
      setArr(arr.filter((i) => i !== item));
    } else {
      setArr([...arr, item]);
    }
  };

  const addCustomRole = () => {
    const trimmed = roleInput.trim();
    if (trimmed && !roles.includes(trimmed)) {
      setRoles([...roles, trimmed]);
      setRoleInput('');
    }
  };

  const addCustomLocation = () => {
    const trimmed = locationInput.trim();
    if (trimmed && !locations.includes(trimmed)) {
      setLocations([...locations, trimmed]);
      setLocationInput('');
    }
  };

  const handleFinish = () => {
    setSearchPreferences({
      roles,
      locations,
      jobTypes,
      remotePreference: remote,
    });
    setOnboarded(true);
    router.replace('/(tabs)');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.progress}>
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
        </View>
      </View>

      <Text style={styles.title}>Job Preferences</Text>
      <Text style={styles.subtitle}>
        Tell us what you're looking for. You can always change these later.
      </Text>

      {/* Roles */}
      <Section title="🎯 Job Roles">
        <ChipGrid
          items={SUGGESTED_ROLES}
          selected={roles}
          onToggle={(item) => toggleItem(roles, item, setRoles)}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Add custom role..."
            placeholderTextColor={Colors.textMuted}
            value={roleInput}
            onChangeText={setRoleInput}
            onSubmitEditing={addCustomRole}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={addCustomRole}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {roles.filter((r) => !SUGGESTED_ROLES.includes(r)).length > 0 && (
          <View style={styles.customChips}>
            {roles
              .filter((r) => !SUGGESTED_ROLES.includes(r))
              .map((r) => (
                <TouchableOpacity
                  key={r}
                  style={styles.customChip}
                  onPress={() => toggleItem(roles, r, setRoles)}
                >
                  <Text style={styles.customChipText}>{r} ✕</Text>
                </TouchableOpacity>
              ))}
          </View>
        )}
      </Section>

      {/* Locations */}
      <Section title="📍 Preferred Locations">
        <ChipGrid
          items={SUGGESTED_LOCATIONS}
          selected={locations}
          onToggle={(item) => toggleItem(locations, item, setLocations)}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Add city or state..."
            placeholderTextColor={Colors.textMuted}
            value={locationInput}
            onChangeText={setLocationInput}
            onSubmitEditing={addCustomLocation}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={addCustomLocation}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </Section>

      {/* Remote */}
      <Section title="🏠 Work Mode">
        <View style={styles.remoteGrid}>
          {REMOTE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.remoteBtn, remote === opt.value && styles.remoteBtnActive]}
              onPress={() => setRemote(opt.value)}
            >
              <Text style={styles.remoteEmoji}>{opt.emoji}</Text>
              <Text
                style={[styles.remoteBtnText, remote === opt.value && styles.remoteBtnTextActive]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      {/* Job Type */}
      <Section title="⏱ Job Type">
        <View style={styles.chipRow}>
          {JOB_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.chip,
                jobTypes.includes(type.value) && styles.chipActive,
              ]}
              onPress={() => toggleItem(jobTypes, type.value, setJobTypes)}
            >
              <Text
                style={[
                  styles.chipText,
                  jobTypes.includes(type.value) && styles.chipTextActive,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      {/* Summary */}
      {(roles.length > 0 || locations.length > 0) && (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Your search will look for:</Text>
          {roles.length > 0 && (
            <Text style={styles.summaryText}>
              🎯 {roles.slice(0, 2).join(', ')}{roles.length > 2 ? ` +${roles.length - 2} more` : ''}
            </Text>
          )}
          {locations.length > 0 && (
            <Text style={styles.summaryText}>
              📍 {locations.slice(0, 2).join(', ')}{locations.length > 2 ? ` +${locations.length - 2}` : ''}
            </Text>
          )}
          <Text style={styles.summaryText}>🏠 {remote === 'any' ? 'All work modes' : remote}</Text>
        </View>
      )}

      {/* Finish */}
      <TouchableOpacity
        style={[styles.finishBtn, (roles.length === 0) && { opacity: 0.7 }]}
        onPress={handleFinish}
        activeOpacity={0.85}
      >
        <LinearGradient colors={Colors.gradients.primary} style={styles.finishBtnGradient}>
          <Text style={styles.finishBtnText}>Start Swiping Jobs ✦</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChipGrid({
  items,
  selected,
  onToggle,
}: {
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {items.map((item) => (
        <TouchableOpacity
          key={item}
          style={[styles.chip, selected.includes(item) && styles.chipActive]}
          onPress={() => onToggle(item)}
        >
          <Text style={[styles.chipText, selected.includes(item) && styles.chipTextActive]}>
            {item}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 48 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  backBtn: { padding: 4 },
  backBtnText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  progress: { flexDirection: 'row', gap: 6 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  progressDotActive: { backgroundColor: Colors.primary, width: 24 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primaryAlpha,
    borderColor: Colors.primary,
  },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: Colors.primaryLight },
  inputRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  addBtn: {
    backgroundColor: Colors.primaryAlpha,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  addBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  customChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  customChip: {
    backgroundColor: Colors.primaryAlpha,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  customChipText: { color: Colors.primaryLight, fontSize: 12, fontWeight: '600' },
  remoteGrid: { flexDirection: 'row', gap: 10 },
  remoteBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  remoteBtnActive: {
    backgroundColor: Colors.primaryAlpha,
    borderColor: Colors.primary,
  },
  remoteEmoji: { fontSize: 22 },
  remoteBtnText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },
  remoteBtnTextActive: { color: Colors.primaryLight },
  summaryBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryText: { fontSize: 14, color: Colors.textSecondary },
  finishBtn: { borderRadius: 16, overflow: 'hidden' },
  finishBtnGradient: { paddingVertical: 18, alignItems: 'center' },
  finishBtnText: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 0.3 },
});
