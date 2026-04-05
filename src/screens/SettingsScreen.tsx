import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../utils/theme';
import { useAppStore } from '../store/useAppStore';
import {
  isModelDownloaded,
  deleteModel,
  getModelFileSize,
} from '../services/llm/ModelDownloader';
import DatabaseService from '../services/database/DatabaseService';

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  danger = false,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.rowIcon, danger && { backgroundColor: '#FFF0EE' }]}>
        <Icon name={icon} size={18} color={danger ? '#BA1A1A' : colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, danger && { color: '#BA1A1A' }]}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {onPress && <Icon name="chevron-right" size={20} color="#908981" />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userName, setUserName, setModelStatus } = useAppStore();
  const [modelSize, setModelSize] = useState('');
  const [modelExists, setModelExists] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userName);

  useEffect(() => {
    checkModel();
  }, []);

  const checkModel = async () => {
    const exists = await isModelDownloaded();
    setModelExists(exists);
    if (exists) {
      const bytes = await getModelFileSize();
      const mb = (bytes / (1024 * 1024)).toFixed(0);
      setModelSize(`${mb} MB`);
    }
  };

  const handleDeleteModel = () => {
    Alert.alert(
      'Delete AI Model?',
      'You will need to re-download 2.5 GB to use AI features again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteModel();
            setModelStatus('not_downloaded');
            setModelExists(false);
            setModelSize('');
          },
        },
      ],
    );
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    setUserName(trimmed);
    await DatabaseService.setSetting('user_name', trimmed);
    setIsEditingName(false);
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
              <Icon name="arrow-left" size={22} color={colors.primary} />
            </Pressable>
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile section */}
        <Text style={styles.sectionLabel}>PROFILE</Text>
        {isEditingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your name"
              placeholderTextColor="#908981"
              autoFocus
              onSubmitEditing={handleSaveName}
            />
            <Pressable onPress={handleSaveName} style={styles.nameSaveBtn}>
              <Text style={styles.nameSaveText}>Save</Text>
            </Pressable>
          </View>
        ) : (
          <SettingsRow
            icon="account-outline"
            label="Name"
            value={userName || 'Not set'}
            onPress={() => {
              setNameInput(userName);
              setIsEditingName(true);
            }}
          />
        )}

        {/* AI Model section */}
        <Text style={[styles.sectionLabel, { marginTop: 32 }]}>AI MODEL</Text>
        <SettingsRow
          icon="chip"
          label="Gemma 4 E2B"
          value={modelExists ? `Downloaded (${modelSize})` : 'Not downloaded'}
        />
        {modelExists && (
          <SettingsRow
            icon="delete-outline"
            label="Delete model"
            value="Free up storage"
            onPress={handleDeleteModel}
            danger
          />
        )}

        {/* Privacy section */}
        <Text style={[styles.sectionLabel, { marginTop: 32 }]}>PRIVACY</Text>
        <SettingsRow
          icon="shield-check-outline"
          label="Data storage"
          value="Encrypted on device only"
        />
        <SettingsRow
          icon="wifi-off"
          label="Network usage"
          value="None after model download"
        />

        {/* About section */}
        <Text style={[styles.sectionLabel, { marginTop: 32 }]}>ABOUT</Text>
        <SettingsRow icon="information-outline" label="Version" value="1.0.0" />
        <SettingsRow
          icon="heart-outline"
          label="Built with"
          value="Gemma 4 E2B + llama.rn"
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Icon name="lock-outline" size={14} color="#908981" />
          <Text style={styles.footerText}>
            MindSafe never sends your data anywhere
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.background,
  },
  headerInner: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#2C2926',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#908981',
    marginBottom: 12,
    marginTop: 8,
  },

  // Settings row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,222,214,0.4)',
  },
  rowPressed: {
    backgroundColor: '#F7F3EB',
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(61,107,79,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2C2926',
  },
  rowValue: {
    fontSize: 12,
    color: '#908981',
    marginTop: 2,
  },

  // Name edit
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,222,214,0.4)',
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    color: '#2C2926',
    backgroundColor: '#F0ECE4',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  nameSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  nameSaveText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 40,
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 11,
    color: '#908981',
  },
});
