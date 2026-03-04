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
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { useAppStore } from '../../store/appStore';
import { parseLatexResume } from '../../lib/resumeParser';
import { readTexFile, saveTexFileToDisk } from '../../lib/userProfile';
import type { ResumeData } from '../../types';

export default function ResumeOnboarding() {
  const { setResumeData, resumeData: existingResume } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ResumeData | null>(existingResume);
  const [fileName, setFileName] = useState('');

  const handleImportResume = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file) return;

      setLoading(true);
      setFileName(file.name);

      const content = await readTexFile(file.uri);

      // Check if it's actually a .tex file
      const isLaTeX = content.includes('\\') || file.name.endsWith('.tex');
      if (!isLaTeX) {
        Alert.alert(
          'Invalid File',
          'Please upload a LaTeX (.tex) file. Text-based resumes are not yet supported.'
        );
        return;
      }

      const resumeData = parseLatexResume(content);

      // Save to device storage
      await saveTexFileToDisk(file.uri);

      setParsed(resumeData);
      setResumeData(resumeData);
    } catch (e) {
      Alert.alert('Import Error', 'Could not parse the resume file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    router.push('/onboarding/preferences');
  };

  const handleSkip = () => {
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
        Upload your LaTeX <Text style={styles.code}>.tex</Text> resume. We'll parse it to
        auto-fill applications and power your AI assistant.
      </Text>

      {/* Supported Formats */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Supported Templates</Text>
        <Text style={styles.infoText}>✓ Jake's Resume template</Text>
        <Text style={styles.infoText}>✓ ModernCV / AltaCV</Text>
        <Text style={styles.infoText}>✓ Any template using \section\{} structure</Text>
        <Text style={[styles.infoText, { color: Colors.textMuted }]}>
          ✕ PDF-only resumes (not yet supported)
        </Text>
      </View>

      {/* Upload Button */}
      <TouchableOpacity
        style={[styles.uploadBtn, loading && { opacity: 0.6 }]}
        onPress={handleImportResume}
        disabled={loading}
        activeOpacity={0.8}
      >
        <LinearGradient colors={Colors.gradients.primary} style={styles.uploadBtnGradient}>
          {loading ? (
            <ActivityIndicator color={Colors.textPrimary} />
          ) : (
            <>
              <Text style={styles.uploadBtnIcon}>📄</Text>
              <Text style={styles.uploadBtnText}>
                {parsed ? 'Re-upload Resume' : 'Upload resume.tex'}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Parsed Preview */}
      {parsed && !loading && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>
            {hasGoodData ? '✓ Resume Parsed Successfully' : '⚠ Partial Parse'}
          </Text>
          {fileName && <Text style={styles.fileName}>📄 {fileName}</Text>}

          {parsed.name && <ParsedRow label="Name" value={parsed.name} />}
          {parsed.email && <ParsedRow label="Email" value={parsed.email} />}

          <ParsedRow
            label="Experience"
            value={
              parsed.experience.length > 0
                ? `${parsed.experience.length} roles`
                : '0 detected'
            }
            good={parsed.experience.length > 0}
          />

          <ParsedRow
            label="Projects"
            value={
              parsed.projects.length > 0
                ? `${parsed.projects.length} projects`
                : '0 detected'
            }
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
                Could not extract detailed data from your resume. You can still continue — AI will
                work with whatever data was found.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Sample LaTeX snippet */}
      {!parsed && (
        <View style={styles.sampleContainer}>
          <Text style={styles.sampleTitle}>Don't have a LaTeX resume?</Text>
          <Text style={styles.sampleText}>
            Use Jake's Free Resume Template on Overleaf — it's the most popular format and works
            perfectly with apply.fy.
          </Text>
          <Text style={styles.sampleLink}>overleaf.com/gallery/tagged/cv</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.continueBtn}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={parsed ? Colors.gradients.success : Colors.gradients.primary}
            style={styles.continueBtnGradient}
          >
            <Text style={styles.continueBtnText}>
              {parsed ? 'Continue →' : 'Continue without resume →'}
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
          good === true
            ? { color: Colors.success }
            : good === false
            ? { color: Colors.danger }
            : {},
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 48,
  },
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
    marginBottom: 24,
  },
  code: {
    fontFamily: 'Courier',
    color: Colors.primaryLight,
  },
  infoBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  uploadBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },
  uploadBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  uploadBtnIcon: { fontSize: 20 },
  uploadBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  preview: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.success,
    marginBottom: 4,
  },
  fileName: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: 'Courier',
    marginBottom: 4,
  },
  parsedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  parsedLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '600', width: 90 },
  parsedValue: { fontSize: 13, color: Colors.textSecondary, flex: 1, textAlign: 'right' },
  warnBox: {
    backgroundColor: Colors.warningAlpha,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  warnText: { color: Colors.warning, fontSize: 13, lineHeight: 18 },
  sampleContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sampleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sampleText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  sampleLink: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  actions: { gap: 12 },
  continueBtn: { borderRadius: 14, overflow: 'hidden' },
  continueBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  continueBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
});
