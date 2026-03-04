import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Share,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../constants/colors';
import type { Job, ResumeData, UserProfile } from '../types';
import {
  answerApplicationQuestion,
  generateCoverLetter,
  COMMON_QUESTIONS,
} from '../lib/aiAssistant';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  job: Job | null;
  visible: boolean;
  onClose: () => void;
  onApply: (job: Job) => void;
  onSave: (job: Job) => void;
  resume: ResumeData | null;
  profile: UserProfile | null;
  hasAI: boolean;
}

type Tab = 'overview' | 'ai' | 'cover';

export default function JobDetailModal({
  job,
  visible,
  onClose,
  onApply,
  onSave,
  resume,
  profile,
  hasAI,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [aiAnswer, setAiAnswer] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!job) return null;

  const handleGenerateAnswer = async (question: string) => {
    if (!resume || !profile || !hasAI) return;
    setSelectedQuestion(question);
    setIsGenerating(true);
    try {
      const answer = await answerApplicationQuestion({ question, job, resume, profile });
      setAiAnswer(answer);
    } catch (e) {
      setAiAnswer('Failed to generate answer. Check your Anthropic API key.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!resume || !profile || !hasAI) return;
    setIsGenerating(true);
    try {
      const letter = await generateCoverLetter({ job, resume, profile });
      setCoverLetter(letter);
    } catch (e) {
      setCoverLetter('Failed to generate cover letter. Check your Anthropic API key.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
  };

  const handleShare = async () => {
    await Share.share({ message: `${job.title} at ${job.company}\n${job.applyUrl}` });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient colors={['#F5FAF6', '#EDF7F0']} style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle} numberOfLines={1}>{job.title}</Text>
              <Text style={styles.headerSubtitle}>{job.company} · {job.location}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {(['overview', 'ai', 'cover'] as Tab[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                  {tab === 'overview' ? '📋 Overview' : tab === 'ai' ? '🤖 AI Answers' : '📝 Cover Letter'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'overview' && (
            <OverviewTab job={job} />
          )}

          {activeTab === 'ai' && (
            <AITab
              hasAI={hasAI}
              questions={COMMON_QUESTIONS}
              selectedQuestion={selectedQuestion}
              aiAnswer={aiAnswer}
              isGenerating={isGenerating}
              onSelectQuestion={handleGenerateAnswer}
              onCopy={handleCopy}
            />
          )}

          {activeTab === 'cover' && (
            <CoverLetterTab
              hasAI={hasAI}
              coverLetter={coverLetter}
              isGenerating={isGenerating}
              onGenerate={handleGenerateCoverLetter}
              onCopy={handleCopy}
            />
          )}
        </ScrollView>

        {/* Action Bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.skipBtn]}
            onPress={onClose}
          >
            <Text style={styles.actionBtnText}>✕ Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.saveBtn]}
            onPress={() => { onSave(job); onClose(); }}
          >
            <Text style={styles.actionBtnText}>⭐ Save</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.applyBtn]}
            onPress={() => {
              WebBrowser.openBrowserAsync(job.applyUrl).catch(() => {});
              onApply(job);
              onClose();
            }}
          >
            <Text style={[styles.actionBtnText, { color: Colors.textInverse }]}>✓ Apply Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OverviewTab({ job }: { job: Job }) {
  return (
    <View>
      {/* Meta */}
      <View style={styles.metaGrid}>
        <MetaItem emoji="📍" label="Location" value={job.location} />
        {job.salary && <MetaItem emoji="💰" label="Salary" value={job.salary} />}
        {job.jobType && <MetaItem emoji="⏱" label="Type" value={job.jobType} />}
        {job.remote && <MetaItem emoji="🏠" label="Work Mode" value={job.remote} />}
        {job.postedDate && (
          <MetaItem emoji="📅" label="Posted" value={formatDate(job.postedDate)} />
        )}
        {job.matchScore !== undefined && (
          <MetaItem emoji="🎯" label="Match Score" value={`${job.matchScore}%`} />
        )}
      </View>

      {/* Tags */}
      {job.tags && job.tags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.tagRow}>
            {job.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About the Role</Text>
        <Text style={styles.bodyText}>{job.description}</Text>
      </View>

      {/* Requirements */}
      {job.requirements && job.requirements.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Requirements</Text>
          {job.requirements.map((req, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{req}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Responsibilities */}
      {job.responsibilities && job.responsibilities.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Responsibilities</Text>
          {job.responsibilities.map((resp, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{resp}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Benefits */}
      {job.benefits && job.benefits.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Benefits</Text>
          {job.benefits.map((b, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>✓</Text>
              <Text style={[styles.bulletText, { color: Colors.success }]}>{b}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function AITab({
  hasAI,
  questions,
  selectedQuestion,
  aiAnswer,
  isGenerating,
  onSelectQuestion,
  onCopy,
}: {
  hasAI: boolean;
  questions: string[];
  selectedQuestion: string | null;
  aiAnswer: string;
  isGenerating: boolean;
  onSelectQuestion: (q: string) => void;
  onCopy: (text: string) => void;
}) {
  if (!hasAI) {
    return (
      <View style={styles.noAI}>
        <Text style={styles.noAIEmoji}>🤖</Text>
        <Text style={styles.noAITitle}>AI Assistant Unavailable</Text>
        <Text style={styles.noAIText}>
          Add your Anthropic API key in your profile to enable AI-powered application answers.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Common Application Questions</Text>
      <Text style={styles.hint}>Tap a question to generate a personalized answer</Text>

      {questions.map((q, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.questionBtn, selectedQuestion === q && styles.questionBtnActive]}
          onPress={() => onSelectQuestion(q)}
        >
          <Text style={styles.questionText}>{q}</Text>
        </TouchableOpacity>
      ))}

      {(isGenerating || aiAnswer) && (
        <View style={styles.answerBox}>
          <View style={styles.answerHeader}>
            <Text style={styles.answerLabel}>
              {isGenerating ? 'Generating...' : '✨ Generated Answer'}
            </Text>
            {!isGenerating && aiAnswer && (
              <TouchableOpacity onPress={() => onCopy(aiAnswer)}>
                <Text style={styles.copyBtn}>Copy</Text>
              </TouchableOpacity>
            )}
          </View>
          {isGenerating ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
          ) : (
            <Text style={styles.answerText}>{aiAnswer}</Text>
          )}
        </View>
      )}
    </View>
  );
}

function CoverLetterTab({
  hasAI,
  coverLetter,
  isGenerating,
  onGenerate,
  onCopy,
}: {
  hasAI: boolean;
  coverLetter: string;
  isGenerating: boolean;
  onGenerate: () => void;
  onCopy: (text: string) => void;
}) {
  if (!hasAI) {
    return (
      <View style={styles.noAI}>
        <Text style={styles.noAIEmoji}>📝</Text>
        <Text style={styles.noAITitle}>AI Required</Text>
        <Text style={styles.noAIText}>Add an Anthropic API key in your profile to generate cover letters.</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Cover Letter Generator</Text>
      <Text style={styles.hint}>
        Generates a tailored cover letter based on your resume and this job description.
      </Text>

      <TouchableOpacity
        style={[styles.generateBtn, isGenerating && { opacity: 0.6 }]}
        onPress={onGenerate}
        disabled={isGenerating}
      >
        <LinearGradient colors={Colors.gradients.primary} style={styles.generateBtnGradient}>
          {isGenerating ? (
            <ActivityIndicator color={Colors.textPrimary} />
          ) : (
            <Text style={styles.generateBtnText}>
              {coverLetter ? '↺ Regenerate Cover Letter' : '✨ Generate Cover Letter'}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {coverLetter && !isGenerating && (
        <View style={styles.answerBox}>
          <View style={styles.answerHeader}>
            <Text style={styles.answerLabel}>Cover Letter</Text>
            <TouchableOpacity onPress={() => onCopy(coverLetter)}>
              <Text style={styles.copyBtn}>Copy</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.answerText}>{coverLetter}</Text>
        </View>
      )}
    </View>
  );
}

function MetaItem({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaEmoji}>{emoji}</Text>
      <View>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue}>{value}</Text>
      </View>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  activeTabText: {
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: '45%',
  },
  metaEmoji: {
    fontSize: 18,
  },
  metaLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  bullet: {
    color: Colors.primary,
    fontSize: 14,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: Colors.primaryAlpha,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  tagText: {
    color: Colors.primaryLight,
    fontSize: 12,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  questionBtn: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  questionBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryAlpha,
  },
  questionText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  answerBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha,
  },
  answerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  answerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  copyBtn: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  answerText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  generateBtn: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  generateBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  generateBtnText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  noAI: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  noAIEmoji: {
    fontSize: 48,
  },
  noAITitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  noAIText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    backgroundColor: Colors.dangerAlpha,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  saveBtn: {
    backgroundColor: Colors.warningAlpha,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  applyBtn: {
    backgroundColor: Colors.success,
    flex: 1.5,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
