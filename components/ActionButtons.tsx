import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';

interface Props {
  onSkip: () => void;
  onApply: () => void;
  onSave: () => void;
  disabled?: boolean;
}

export default function ActionButtons({ onSkip, onApply, onSave, disabled }: Props) {
  return (
    <View style={styles.container}>
      <ActionButton
        emoji="✕"
        label="Skip"
        color={Colors.danger}
        bgColor={Colors.dangerAlpha}
        onPress={onSkip}
        disabled={disabled}
        size="medium"
      />

      <ActionButton
        emoji="✓"
        label="Apply"
        color={Colors.textInverse}
        gradient={Colors.gradients.success}
        onPress={onApply}
        disabled={disabled}
        size="large"
      />

      <ActionButton
        emoji="★"
        label="Save"
        color={Colors.warning}
        bgColor={Colors.warningAlpha}
        onPress={onSave}
        disabled={disabled}
        size="medium"
      />
    </View>
  );
}

interface ActionButtonProps {
  emoji: string;
  label: string;
  color: string;
  bgColor?: string;
  gradient?: readonly [string, string, ...string[]];
  onPress: () => void;
  disabled?: boolean;
  size: 'medium' | 'large';
}

function ActionButton({
  emoji,
  label,
  color,
  bgColor,
  gradient,
  onPress,
  disabled,
  size,
}: ActionButtonProps) {
  const buttonSize = size === 'large' ? 72 : 56;

  const inner = (
    <>
      <Text style={[styles.emoji, size === 'large' && styles.emojiLarge]}>{emoji}</Text>
      <Text style={[styles.label, { color: size === 'large' ? Colors.textInverse : color }]}>
        {label}
      </Text>
    </>
  );

  return (
    <TouchableOpacity
      style={[styles.button, { opacity: disabled ? 0.4 : 1 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      {gradient ? (
        <LinearGradient
          colors={gradient}
          style={[
            styles.buttonInner,
            { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
          ]}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.buttonInner,
            {
              width: buttonSize,
              height: buttonSize,
              borderRadius: buttonSize / 2,
              backgroundColor: bgColor,
              borderWidth: 2,
              borderColor: color,
            },
          ]}
        >
          {inner}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 8,
  },
  button: {
    alignItems: 'center',
    gap: 6,
  },
  buttonInner: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  emoji: {
    fontSize: 20,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  emojiLarge: {
    fontSize: 26,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    position: 'absolute',
    bottom: -20,
  },
});
