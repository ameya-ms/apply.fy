import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { useAppStore } from '../../store/appStore';
import { saveProfile, saveProfileEnvFile } from '../../lib/userProfile';
import { initAI } from '../../lib/aiAssistant';
import type { UserProfile } from '../../types';

// ─── Form State ───────────────────────────────────────────────────────────────

interface FormData {
  name: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  skills: string;
  yearsExperience: string;
  preferredRoles: string;
  preferredLocations: string;
  remotePreference: string;
  salaryMin: string;
  salaryMax: string;
  anthropicApiKey: string;
  jsearchApiKey: string;
}

const defaultForm: FormData = {
  name: '',
  email: '',
  phone: '',
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
  skills: '',
  yearsExperience: '',
  preferredRoles: '',
  preferredLocations: '',
  remotePreference: 'any',
  salaryMin: '',
  salaryMax: '',
  anthropicApiKey: '',
  jsearchApiKey: '',
};

// ─── Validation ───────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, '').length >= 10;
}

function isValidUrl(url: string): boolean {
  return url.startsWith('https://');
}

function validateStep(step: number, form: FormData): string[] {
  const errors: string[] = [];

  switch (step) {
    case 0: {
      if (!form.name.trim()) errors.push('Full name is required');
      if (!form.email.trim()) {
        errors.push('Email address is required');
      } else if (!isValidEmail(form.email)) {
        errors.push('Please enter a valid email address (e.g. jane@example.com)');
      }
      if (form.phone.trim() && !isValidPhone(form.phone)) {
        errors.push('Phone number must have at least 10 digits');
      }
      break;
    }
    case 1: {
      if (form.linkedinUrl.trim() && !isValidUrl(form.linkedinUrl.trim())) {
        errors.push('LinkedIn URL must start with https://');
      }
      if (form.githubUrl.trim() && !isValidUrl(form.githubUrl.trim())) {
        errors.push('GitHub URL must start with https://');
      }
      if (form.portfolioUrl.trim() && !isValidUrl(form.portfolioUrl.trim())) {
        errors.push('Portfolio URL must start with https://');
      }
      break;
    }
    case 2: {
      if (form.yearsExperience.trim()) {
        const yrs = parseInt(form.yearsExperience, 10);
        if (isNaN(yrs) || yrs < 0 || yrs > 60) {
          errors.push('Years of experience must be a number between 0 and 60');
        }
      }
      break;
    }
    case 3: {
      if (form.salaryMin.trim()) {
        const min = parseInt(form.salaryMin, 10);
        if (isNaN(min) || min < 0) errors.push('Minimum salary must be a positive number');
      }
      if (form.salaryMax.trim()) {
        const max = parseInt(form.salaryMax, 10);
        if (isNaN(max) || max < 0) errors.push('Maximum salary must be a positive number');
      }
      if (form.salaryMin.trim() && form.salaryMax.trim()) {
        const min = parseInt(form.salaryMin, 10);
        const max = parseInt(form.salaryMax, 10);
        if (!isNaN(min) && !isNaN(max) && max < min) {
          errors.push('Maximum salary must be greater than minimum salary');
        }
      }
      break;
    }
    // step 4 (API Keys) — no required fields
  }

  return errors;
}

// ─── Profile Conversion ───────────────────────────────────────────────────────

function formToProfile(form: FormData): UserProfile {
  const parseList = (val: string) =>
    val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const remoteRaw = form.remotePreference;
  const remotePreference =
    remoteRaw === 'remote' || remoteRaw === 'hybrid' || remoteRaw === 'onsite'
      ? (remoteRaw as 'remote' | 'hybrid' | 'onsite')
      : 'any';

  return {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    linkedinUrl: form.linkedinUrl.trim() || undefined,
    githubUrl: form.githubUrl.trim() || undefined,
    portfolioUrl: form.portfolioUrl.trim() || undefined,
    resumeTexPath: undefined,
    skills: parseList(form.skills),
    yearsExperience: parseInt(form.yearsExperience, 10) || 0,
    preferredRoles: parseList(form.preferredRoles),
    preferredLocations: parseList(form.preferredLocations),
    remotePreference,
    salaryMin: form.salaryMin ? parseInt(form.salaryMin, 10) : undefined,
    salaryMax: form.salaryMax ? parseInt(form.salaryMax, 10) : undefined,
    anthropicApiKey: form.anthropicApiKey.trim() || undefined,
    jsearchApiKey: form.jsearchApiKey.trim() || undefined,
    museApiKey: undefined,
    backendUrl: undefined,
  };
}

// ─── Step Metadata ────────────────────────────────────────────────────────────

const STEPS = [
  { title: 'Basic Info', subtitle: 'Tell us about yourself — required to get started' },
  { title: 'Online Presence', subtitle: 'Add your professional links (all optional)' },
  { title: 'Skills & Experience', subtitle: 'What are you good at?' },
  { title: 'Job Preferences', subtitle: 'What kind of work are you looking for?' },
  { title: 'API Keys', subtitle: 'Connect AI and job services (all optional)' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileOnboarding() {
  const { setUserProfile } = useAppStore();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors.length > 0) setFieldErrors([]);
  };

  const handleNext = async () => {
    const errors = validateStep(step, form);
    if (errors.length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors([]);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      await handleSave();
    }
  };

  const handleBack = () => {
    setFieldErrors([]);
    if (step > 0) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const profile = formToProfile(form);
      await saveProfileEnvFile(profile);
      await saveProfile(profile);
      setUserProfile(profile);
      if (profile.anthropicApiKey) {
        initAI(profile.anthropicApiKey);
      }
      router.push('/onboarding/resume');
    } catch {
      Alert.alert('Error', 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.push('/onboarding/resume');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← {step === 0 ? 'Back' : STEPS[step - 1]?.title}</Text>
          </TouchableOpacity>
          <View style={styles.progress}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i === step && styles.progressDotActive,
                  i < step && styles.progressDotDone,
                ]}
              />
            ))}
          </View>
        </View>

        <Text style={styles.stepLabel}>Step {step + 1} of {STEPS.length}</Text>
        <Text style={styles.title}>{STEPS[step]?.title}</Text>
        <Text style={styles.subtitle}>{STEPS[step]?.subtitle}</Text>

        {/* Step Content */}
        {step === 0 && <BasicInfoStep form={form} update={update} />}
        {step === 1 && <OnlinePresenceStep form={form} update={update} />}
        {step === 2 && <SkillsStep form={form} update={update} />}
        {step === 3 && <PreferencesStep form={form} update={update} />}
        {step === 4 && <ApiKeysStep form={form} update={update} />}

        {/* Validation Errors */}
        {fieldErrors.length > 0 && (
          <View style={styles.errorBox}>
            {fieldErrors.map((e, i) => (
              <Text key={i} style={styles.errorText}>⚠ {e}</Text>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.nextBtn, saving && { opacity: 0.6 }]}
            onPress={handleNext}
            disabled={saving}
            activeOpacity={0.85}
          >
            <LinearGradient colors={Colors.gradients.primary} style={styles.nextBtnGradient}>
              {saving ? (
                <ActivityIndicator color={Colors.textInverse} />
              ) : (
                <Text style={styles.nextBtnText}>
                  {step === STEPS.length - 1 ? 'Save & Continue →' : 'Next →'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {step === 0 && (
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipBtnText}>Skip setup for now</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Shared Types & Components ────────────────────────────────────────────────

interface StepProps {
  form: FormData;
  update: (field: keyof FormData, value: string) => void;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

// ─── Step 1: Basic Info ───────────────────────────────────────────────────────

function BasicInfoStep({ form, update }: StepProps) {
  return (
    <View style={styles.stepContent}>
      <Field label="Full Name *">
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(v) => update('name', v)}
          placeholder="Jane Smith"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="words"
          returnKeyType="next"
        />
      </Field>
      <Field label="Email Address *">
        <TextInput
          style={styles.input}
          value={form.email}
          onChangeText={(v) => update('email', v)}
          placeholder="jane@example.com"
          placeholderTextColor={Colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />
      </Field>
      <Field label="Phone Number" hint="Optional — needed for some job applications">
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={(v) => update('phone', v)}
          placeholder="+1 555 000 0000"
          placeholderTextColor={Colors.textMuted}
          keyboardType="phone-pad"
          returnKeyType="done"
        />
      </Field>
    </View>
  );
}

// ─── Step 2: Online Presence ──────────────────────────────────────────────────

function OnlinePresenceStep({ form, update }: StepProps) {
  return (
    <View style={styles.stepContent}>
      <Field label="LinkedIn URL" hint="Must start with https://">
        <TextInput
          style={styles.input}
          value={form.linkedinUrl}
          onChangeText={(v) => update('linkedinUrl', v)}
          placeholder="https://linkedin.com/in/janesmith"
          placeholderTextColor={Colors.textMuted}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />
      </Field>
      <Field label="GitHub URL" hint="Must start with https://">
        <TextInput
          style={styles.input}
          value={form.githubUrl}
          onChangeText={(v) => update('githubUrl', v)}
          placeholder="https://github.com/janesmith"
          placeholderTextColor={Colors.textMuted}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />
      </Field>
      <Field label="Portfolio / Website" hint="Must start with https://">
        <TextInput
          style={styles.input}
          value={form.portfolioUrl}
          onChangeText={(v) => update('portfolioUrl', v)}
          placeholder="https://janesmith.dev"
          placeholderTextColor={Colors.textMuted}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
        />
      </Field>
    </View>
  );
}

// ─── Step 3: Skills & Experience ─────────────────────────────────────────────

function SkillsStep({ form, update }: StepProps) {
  return (
    <View style={styles.stepContent}>
      <Field label="Skills" hint="Comma-separated list of your skills">
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={form.skills}
          onChangeText={(v) => update('skills', v)}
          placeholder="React, TypeScript, Node.js, Python, SQL, AWS"
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={3}
          returnKeyType="default"
        />
      </Field>
      <Field label="Years of Experience" hint="Total years working in your field (0–60)">
        <TextInput
          style={styles.input}
          value={form.yearsExperience}
          onChangeText={(v) => update('yearsExperience', v.replace(/[^0-9]/g, ''))}
          placeholder="4"
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          returnKeyType="done"
        />
      </Field>
    </View>
  );
}

// ─── Step 4: Job Preferences ──────────────────────────────────────────────────

const REMOTE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Remote', value: 'remote' },
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'On-site', value: 'onsite' },
  { label: 'Any', value: 'any' },
];

function PreferencesStep({ form, update }: StepProps) {
  return (
    <View style={styles.stepContent}>
      <Field label="Preferred Roles" hint="Comma-separated — what job titles are you looking for?">
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={form.preferredRoles}
          onChangeText={(v) => update('preferredRoles', v)}
          placeholder="Software Engineer, Frontend Developer, Full Stack"
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={2}
        />
      </Field>
      <Field label="Preferred Locations" hint="Comma-separated — cities, states, or Remote">
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={form.preferredLocations}
          onChangeText={(v) => update('preferredLocations', v)}
          placeholder="San Francisco CA, Remote, New York NY"
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={2}
        />
      </Field>
      <Field label="Work Arrangement">
        <View style={styles.segmented}>
          {REMOTE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.segmentBtn,
                form.remotePreference === opt.value && styles.segmentBtnActive,
              ]}
              onPress={() => update('remotePreference', opt.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  form.remotePreference === opt.value && styles.segmentBtnTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Field>
      <View style={styles.salaryRow}>
        <View style={styles.salaryField}>
          <Field label="Min Salary ($)" hint="Annual, e.g. 80000">
            <TextInput
              style={styles.input}
              value={form.salaryMin}
              onChangeText={(v) => update('salaryMin', v.replace(/[^0-9]/g, ''))}
              placeholder="80000"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
          </Field>
        </View>
        <View style={styles.salaryField}>
          <Field label="Max Salary ($)" hint="Annual, e.g. 130000">
            <TextInput
              style={styles.input}
              value={form.salaryMax}
              onChangeText={(v) => update('salaryMax', v.replace(/[^0-9]/g, ''))}
              placeholder="130000"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
          </Field>
        </View>
      </View>
    </View>
  );
}

// ─── Step 5: API Keys ─────────────────────────────────────────────────────────

function ApiKeysStep({ form, update }: StepProps) {
  return (
    <View style={styles.stepContent}>
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Why API keys?</Text>
        <Text style={styles.infoText}>
          An Anthropic key enables AI-powered cover letters, application answers, and PDF resume
          parsing.{'\n\n'}A JSearch key (from RapidAPI) unlocks a larger job database with more
          listings.{'\n\n'}Both are completely optional — the app works without them.
        </Text>
      </View>
      <Field label="Anthropic API Key" hint="Starts with sk-ant- · Get yours at console.anthropic.com">
        <TextInput
          style={styles.input}
          value={form.anthropicApiKey}
          onChangeText={(v) => update('anthropicApiKey', v)}
          placeholder="sk-ant-..."
          placeholderTextColor={Colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />
      </Field>
      <Field label="JSearch API Key" hint="From RapidAPI · rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch">
        <TextInput
          style={styles.input}
          value={form.jsearchApiKey}
          onChangeText={(v) => update('jsearchApiKey', v)}
          placeholder="Your RapidAPI key"
          placeholderTextColor={Colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
        />
      </Field>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 48 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  backBtn: { padding: 4 },
  backBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  progress: { flexDirection: 'row', gap: 5 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  progressDotActive: { backgroundColor: Colors.primary, width: 20 },
  progressDotDone: { backgroundColor: Colors.primaryLight },

  stepLabel: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 4 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 28 },

  stepContent: { gap: 4, marginBottom: 8 },

  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  fieldHint: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },

  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 70,
    paddingTop: 12,
    textAlignVertical: 'top',
  },

  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  segmentBtnActive: { backgroundColor: Colors.primary },
  segmentBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  segmentBtnTextActive: { color: Colors.textInverse },

  salaryRow: { flexDirection: 'row', gap: 12 },
  salaryField: { flex: 1 },

  infoBox: {
    backgroundColor: Colors.primaryAlpha,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  infoText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },

  errorBox: {
    backgroundColor: Colors.dangerAlpha,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.danger,
    gap: 4,
  },
  errorText: { color: Colors.danger, fontSize: 13, lineHeight: 18 },

  actions: { gap: 12, marginTop: 8 },
  nextBtn: { borderRadius: 14, overflow: 'hidden' },
  nextBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textInverse },

  skipBtn: { paddingVertical: 14, alignItems: 'center' },
  skipBtnText: { fontSize: 14, color: Colors.textMuted, fontWeight: '600' },
});
