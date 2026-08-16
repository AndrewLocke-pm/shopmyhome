import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Store,
  CheckCircle2,
  Info,
  Cpu,
  LogOut,
} from 'lucide-react-native';
import { getSetting, setSetting } from '@/lib/supabase';
import { useAuth, useUser } from '@clerk/clerk-expo';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function FieldRow({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const userId = user?.id ?? '';

  const [shopDomain, setShopDomain] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const [domain, token] = await Promise.all([
        getSetting('shopify_domain', userId),
        getSetting('shopify_access_token', userId),
      ]);
      if (domain) setShopDomain(domain);
      if (token) setAccessToken(token);
    }
    load();
  }, [userId]);

  const save = useCallback(async () => {
    if (!shopDomain.trim() || !accessToken.trim()) {
      Alert.alert('Missing Fields', 'Please enter your Shopify store domain and access token.');
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        setSetting('shopify_domain', shopDomain.trim(), userId),
        setSetting('shopify_access_token', accessToken.trim(), userId),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [shopDomain, accessToken, userId]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {user?.primaryEmailAddress?.emailAddress ? (
            <View style={styles.accountCard}>
              <View style={styles.accountInfo}>
                <Text style={styles.accountLabel}>Signed in as</Text>
                <Text style={styles.accountEmail}>{user.primaryEmailAddress.emailAddress}</Text>
              </View>
              <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <LogOut size={16} color="#DC2626" />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Section title="Shopify Store">
            <FieldRow
              label="Store Domain"
              hint="e.g. my-store.myshopify.com"
              value={shopDomain}
              onChangeText={setShopDomain}
              placeholder="your-store.myshopify.com"
            />
            <View style={styles.divider} />
            <FieldRow
              label="Admin API Access Token"
              hint="Found in Shopify Admin > Apps > Custom apps"
              value={accessToken}
              onChangeText={setAccessToken}
              placeholder="shpat_xxxxxxxxxxxx"
              secureTextEntry
            />
          </Section>

          <View style={styles.infoBox}>
            <Info size={16} color="#0F766E" />
            <Text style={styles.infoText}>
              Create a custom app in your Shopify Admin with{' '}
              <Text style={{ fontWeight: '600' }}>Products (Read & Write)</Text> permissions to get an access token.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={save}
            disabled={saving}
          >
            {saved ? (
              <>
                <CheckCircle2 size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Saved!</Text>
              </>
            ) : (
              <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Settings'}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.aboutCard}>
            <View style={styles.aboutRow}>
              <Cpu size={18} color="#0F766E" />
              <Text style={styles.aboutLabel}>AI Model</Text>
              <Text style={styles.aboutValue}>Claude claude-opus-4-5</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.aboutRow}>
              <Store size={18} color="#0F766E" />
              <Text style={styles.aboutLabel}>Shopify API</Text>
              <Text style={styles.aboutValue}>2026-07</Text>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  scroll: { padding: 20, gap: 16, paddingBottom: 48 },
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountInfo: { gap: 2 },
  accountLabel: { fontSize: 12, color: '#64748B' },
  accountEmail: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FFF5F5',
  },
  signOutText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  fieldRow: { padding: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#0F172A', marginBottom: 4 },
  fieldHint: { fontSize: 12, color: '#64748B', marginBottom: 8, lineHeight: 17 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
  },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16 },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, color: '#0F766E', lineHeight: 19 },
  saveButton: {
    backgroundColor: '#0F766E',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  aboutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  aboutLabel: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '500' },
  aboutValue: { fontSize: 13, color: '#64748B' },
});
