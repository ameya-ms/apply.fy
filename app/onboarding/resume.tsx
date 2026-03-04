import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { useAppStore } from '../../store/appStore';
import { parseResumeFromPDF } from '../../lib/aiAssistant';
import { saveResumeJSON } from '../../lib/userProfile';
import type { ResumeData } from '../../types';

export default function ResumeOnboarding() {
  const { setResumeData, resumeData: existingResume, userProfile } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ResumeData | null>(existingResume);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');

  const hasApiKey = !!userProfile?.anthropicApiKey;

  const handlePickPDF = async () => {
    if (!hasApiKey) {
      Alert.alert(
        'API Key Required',
        'PDF parsing uses Claude AI and requires an Anthropic API key. You can skip for now and come back after adding your key in Profile settings.'
      );
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const file = result.assets[0];
      if (!file) return;

      setLoading(true);
      setParseError('');
      setFileName(file.name);

      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const resumeData = await parseResumeFromPDF(base64);
      await saveResumeJSON(resumeData);

      setParsed(resumeData);
      setResumeData(resumeData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setParseError(msg);
      Alert.alert(
        'Parse Error',
        'Could not extract data from the PDF. Please ensure it is a valid, text-based resume PDF (not a scanned image).'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    router.push('/onboarding/preferences');
  };

  const hasGoodData =
    parsed &&
    (parsed.experience.length > 0 || parsed.skills.length > 0 || parsed.education.length > 0);

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
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressDot} />
        </View>
      </View>

      <Text style={styles.title}>Upload Your Resume</Text>
      <Text style={styles.subtitle}>
        Upload your resume as a PDF. Claude AI will extract your experience, skills, and education
        to auto-fill job applications.
      </Text>

      {!hasApiKey && (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>
            No Anthropic API key found. PDF parsing requires an API key — you added it on the
            previous step. You can skip this step for now and upload your resume later from the
            Profile tab.
          </Text>
        </View>
      )}

      {/* Upload Button */}
      <TouchableOpacity
        style={[styles.uploadBtn, (loading || !hasApiKey) && styles.uploadBtnDisabled]}
        onPress={handlePickPDF}
        disabled={loading || !hasApiKey}
        activeOpacity={0.8}
      >
        <LinearGradient colors={Colors.gradients.primary} style={styles.uploadBtnGradient}>
          {loading ? (
            <>
              <ActivityIndicator color={Colors.textInverse} />
              <Text style={styles.uploadBtnText}>Parsing with AI...</Text>
            </>
          ) : (
            <>
              <Text style={styles.uploadBtnIcon}>📄</Text>
              <Text style={styles.uploadBtnText}>
                {parsed ? 'Re-upload Resume PDF' : 'Choose Resume PDF'}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {parseError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{parseError}</Text>
        </View>
      ) : null}

      {/* Parsed Preview */}
      {parsed && !loading && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>
            {hasGoodData ? '✓ Resume Parsed Successfully' : '⚠ Partial Parse'}
          </Text>
          {fileName ? <Text style={styles.fileName}>📄 {fileName}</Text> : null}

          {parsed.name ? <ParsedRow label="Name" value={parsed.name} /> : null}
          {parsed.email ? <ParsedRow label="Email" value={parsed.email} /> : null}

          <ParsedRow
            label="Experience"
            value={parsed.experience.length > 0 ? `${parsed.experience.length} roles` : '0 detected'}
            good={parsed.experience.length > 0}
          />
          <ParsedRow
            label="Projects"
            value={parsed.projects.length > 0 ? `${parsed.projects.length} projects` : '0 detected'}
          />
          <ParsedRow
            label="Education"
            value={
              parsed.education.length > 0
                ? parsed.education[0]?.institution ?? `${parsed.education.length} entries`
                : '0 detected'
            }
          />
          <ParsedRow
            label="Skills"
            value={
              parsed.skills.length > 0
                ? `${parsed.skills.slice(0, 5).join(', ')}${parsed.skills.length > 5 ? ` +${parsed.skills.length - 5}` : ''}`
                : 'None detected'
            }
            good={parsed.skills.length > 0}
          />

          {!hasGoodData && (
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>
                Could not extract detailed data. You can still continue — AI features will work
                with whatever was found.
              </Text>
            </View>
          )}
        </View>
      )}

      {!parsed && hasApiKey && (
        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>Tips for best results</Text>
          <Text style={styles.tipText}>• Use a standard resume PDF (not a scanned image)</Text>
          <Text style={styles.tipText}>• Text should be selectable/copyable in the PDF</Text>
          <Text style={styles.tipText}>• Common formats like chronological work best</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.85}>
          <LinearGradient
            colors={parsed ? Colors.gradients.success : Colors.gradients.primary}
            style={styles.continueBtnGradient}
          >
            <Text style={styles.continueBtnText}>
              {parsed ? 'Continue →' : 'Skip for now →'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function ParsedRow({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <View style={styles.parsedRow}>
      <Text style={styles.parsedLabel}>{label}</Text>
      <Text
        style={[
          styles.parsedValue,
          good === true ? { color: Colors.success } : good === false ? { color: Colors.danger } : {},
        ]}
      >
        {value}
      </Text>
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
  subtitle: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 24 },
  warnBox: {
    backgroundColor: Colors.warningAlpha,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  warnText: { color: Colors.warning, fontSize: 13, lineHeight: 18 },
  errorBox: {
    backgroundColor: Colors.dangerAlpha,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  errorText: { color: Colors.danger, fontSize: 13 },
  uploadBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 20 },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  uploadBtnIcon: { fontSize: 20 },
  uploadBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textInverse },
  preview: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  previewTitle: { fontSize: 15, fontWeight: '700', color: Colors.success, marginBottom: 4 },
  fileName: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  parsedRow: { flexDirection: 'row', justifyContent: 'space-between' },
  parsedLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '600', width: 90 },
  parsedValue: { fontSize: 13, color: Colors.textSecondary, flex: 1, textAlign: 'right' },
  tipBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  tipTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  tipText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  actions: { gap: 12 },
  continueBtn: { borderRadius: 14, overflow: 'hidden' },
  continueBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  continueBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textInverse },
});
