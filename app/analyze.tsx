import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Sparkles,
  X,
  Tag,
  DollarSign,
  FileText,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Pencil,
} from 'lucide-react-native';
import { analyzeProductImage, publishToShopify, uploadProductImage } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-expo';

type Step = 'analyzing' | 'editing' | 'publishing' | 'done' | 'error';

function TagPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <TouchableOpacity style={styles.tagPill} onPress={onRemove}>
      <Text style={styles.tagPillText}>{label}</Text>
      <X size={12} color="#0F766E" />
    </TouchableOpacity>
  );
}

export default function AnalyzeScreen() {
  const router = useRouter();
  const { user } = useUser();
  const userId = user?.id ?? '';
  const { imageUri, imageBase64 } = useLocalSearchParams<{
    imageUri: string;
    imageBase64: string;
  }>();

  const [step, setStep] = useState<Step>('analyzing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [publishedUrl, setPublishedUrl] = useState('');
  const [shopifyAdminUrl, setShopifyAdminUrl] = useState('');
  const [productDbId, setProductDbId] = useState<string | null>(null);
  const [showFeatures, setShowFeatures] = useState(false);
  const [publishStatus, setPublishStatus] = useState<'draft' | 'active' | 'publish'>('draft');

  const runAnalysis = useCallback(async () => {
    if (!imageBase64) {
      setErrorMsg('No image data provided.');
      setStep('error');
      return;
    }
    setStep('analyzing');
    setErrorMsg('');
    try {
      const result = await analyzeProductImage(imageBase64, 'image/jpeg');
      setTitle(result.title ?? '');
      setDescription(result.description ?? '');
      setPrice(result.suggestedPrice ? String(result.suggestedPrice) : '');
      setTags(result.tags ?? []);
      setFeatures(result.keyFeatures ?? []);
      setCategory(result.category ?? '');
      setStep('editing');
    } catch (err) {
      setErrorMsg(String(err));
      setStep('error');
    }
  }, [imageBase64]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  const addTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setTagInput('');
  }, [tagInput, tags]);

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  }, []);

  const publish = useCallback(async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing Info', 'Title and description are required.');
      return;
    }

    setStep('publishing');
    setErrorMsg('');

    try {
      // Upload image to Storage first; use the public URL for both Shopify and DB.
      let storedImageUrl = imageUri ?? '';
      if (imageBase64) {
        storedImageUrl = await uploadProductImage(imageBase64);
      }

      const result = await publishToShopify({
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price) || 0,
        tags,
        imageUrl: storedImageUrl || undefined,
        status: publishStatus,
      });

      const { data: inserted } = await supabase
        .from('products')
        .insert({
          clerk_user_id: userId,
          title: title.trim(),
          description: description.trim(),
          price: parseFloat(price) || null,
          tags,
          image_url: storedImageUrl,
          shopify_product_id: result.productId,
          shopify_status: 'published',
          shopify_url: result.shopifyUrl,
        })
        .select('id')
        .single();

      if (inserted) setProductDbId(inserted.id);
      setPublishedUrl(result.shopifyUrl);
      setShopifyAdminUrl(result.adminUrl);
      setStep('done');
    } catch (err) {
      const msg = String(err);

      if (msg.includes('shopify_not_configured')) {
        Alert.alert(
          'Shopify Not Configured',
          'Please add your Shopify store domain and access token in Settings.',
          [
            { text: 'Cancel', onPress: () => setStep('editing') },
            { text: 'Go to Settings', onPress: () => router.push('/settings') },
          ]
        );
        setStep('editing');
        return;
      }

      setErrorMsg(msg);

      await supabase.from('products').upsert(
        productDbId
          ? { id: productDbId, shopify_status: 'failed' }
          : {
              clerk_user_id: userId,
              title: title.trim(),
              description: description.trim(),
              price: parseFloat(price) || null,
              tags,
              image_url: imageUri,
              shopify_status: 'failed',
            }
      );

      setStep('error');
    }
  }, [
    title, description, price, tags, imageBase64, imageUri,
    publishStatus, productDbId, router, userId,
  ]);

  const saveDraftLocally = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Missing Info', 'Please add a title before saving.');
      return;
    }
    await supabase.from('products').insert({
      clerk_user_id: userId,
      title: title.trim(),
      description: description.trim(),
      price: parseFloat(price) || null,
      tags,
      image_url: imageUri,
      shopify_status: 'pending',
    });
    Alert.alert('Saved', 'Product saved as draft in your history.');
    router.push('/history');
  }, [title, description, price, tags, imageUri, router, userId]);

  // Analyzing loader
  if (step === 'analyzing') {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <View style={styles.analyzingCard}>
          <View style={styles.analyzingIcon}>
            <Sparkles size={36} color="#0F766E" strokeWidth={1.5} />
          </View>
          <ActivityIndicator size="large" color="#0F766E" style={{ marginTop: 8 }} />
          <Text style={styles.analyzingTitle}>Analyzing Product</Text>
          <Text style={styles.analyzingSubtitle}>
            Claude AI is identifying your product and crafting a description...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <View style={styles.errorCard}>
          <AlertCircle size={48} color="#DC2626" strokeWidth={1.5} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMsg}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={runAnalysis}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Text style={styles.closeButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Success state
  if (step === 'done') {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ScrollView contentContainerStyle={styles.doneContent}>
          <View style={styles.doneIcon}>
            <CheckCircle2 size={56} color="#059669" strokeWidth={1.5} />
          </View>
          <Text style={styles.doneTitle}>Published to Shopify!</Text>
          <Text style={styles.doneSubtitle}>
            Your product is now{' '}
            {publishStatus === 'draft'
              ? 'saved as a draft'
              : publishStatus === 'publish'
              ? 'published to your Online Store'
              : 'active'}{' '}
            on Shopify.
          </Text>

          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.doneImage} resizeMode="cover" />
          )}

          <View style={styles.doneDetail}>
            <Text style={styles.doneDetailTitle}>{title}</Text>
            <Text style={styles.doneDetailDesc}>{description}</Text>
            {price && <Text style={styles.doneDetailPrice}>${parseFloat(price).toFixed(2)}</Text>}
          </View>

          <TouchableOpacity style={styles.adminButton} onPress={() => router.push('/history')}>
            <ShoppingBag size={18} color="#FFFFFF" />
            <Text style={styles.adminButtonText}>View in History</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.anotherButton} onPress={() => router.push('/')}>
            <Text style={styles.anotherButtonText}>List Another Product</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Edit form (main state)
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <X size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Review & Publish</Text>
        <TouchableOpacity onPress={saveDraftLocally}>
          <Text style={styles.topBarSave}>Save Draft</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.productImage} resizeMode="cover" />
          )}

          {category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{category}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <View style={styles.fieldHeader}>
              <Pencil size={14} color="#64748B" />
              <Text style={styles.fieldLabel}>Product Title</Text>
            </View>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Product title"
              placeholderTextColor="#94A3B8"
              maxLength={80}
            />
            <Text style={styles.charCount}>{title.length}/80</Text>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.fieldHeader}>
              <FileText size={14} color="#64748B" />
              <Text style={styles.fieldLabel}>Description</Text>
            </View>
            <TextInput
              style={styles.descInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Product description"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.fieldHeader}>
              <DollarSign size={14} color="#64748B" />
              <Text style={styles.fieldLabel}>Price (USD)</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceCurrency}>$</Text>
              <TextInput
                style={styles.priceInput}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.fieldHeader}>
              <Tag size={14} color="#64748B" />
              <Text style={styles.fieldLabel}>Tags</Text>
            </View>
            <View style={styles.tagInputRow}>
              <TextInput
                style={styles.tagTextInput}
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Add a tag..."
                placeholderTextColor="#94A3B8"
                onSubmitEditing={addTag}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addTagButton} onPress={addTag}>
                <Text style={styles.addTagText}>Add</Text>
              </TouchableOpacity>
            </View>
            {tags.length > 0 && (
              <View style={styles.tagWrap}>
                {tags.map(t => (
                  <TagPill key={t} label={t} onRemove={() => removeTag(t)} />
                ))}
              </View>
            )}
          </View>

          {features.length > 0 && (
            <TouchableOpacity
              style={styles.featuresToggle}
              onPress={() => setShowFeatures(v => !v)}
            >
              <Text style={styles.featuresToggleText}>AI-identified Key Features</Text>
              {showFeatures ? (
                <ChevronUp size={16} color="#64748B" />
              ) : (
                <ChevronDown size={16} color="#64748B" />
              )}
            </TouchableOpacity>
          )}
          {showFeatures && (
            <View style={styles.featuresList}>
              {features.map((f, i) => (
                <View key={i} style={styles.featureItem}>
                  <View style={styles.featureDot} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.publishStatusRow}>
            <Text style={styles.fieldLabel}>Publish as</Text>
            <View style={styles.statusToggle}>
              <TouchableOpacity
                style={[styles.statusOption, publishStatus === 'draft' && styles.statusActive]}
                onPress={() => setPublishStatus('draft')}
              >
                <Text
                  style={[
                    styles.statusOptionText,
                    publishStatus === 'draft' && styles.statusActiveText,
                  ]}
                >
                  Draft
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusOption, publishStatus === 'active' && styles.statusActive]}
                onPress={() => setPublishStatus('active')}
              >
                <Text
                  style={[
                    styles.statusOptionText,
                    publishStatus === 'active' && styles.statusActiveText,
                  ]}
                >
                  Active
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusOption, publishStatus === 'publish' && styles.statusActive]}
                onPress={() => setPublishStatus('publish')}
              >
                <Text
                  style={[
                    styles.statusOptionText,
                    publishStatus === 'publish' && styles.statusActiveText,
                  ]}
                >
                  Publish
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {step === 'publishing' ? (
            <View style={styles.publishingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.publishButtonText}>Publishing to Shopify...</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.publishButton} onPress={publish}>
              <ShoppingBag size={20} color="#FFFFFF" />
              <Text style={styles.publishButtonText}>Publish to Shopify</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centerContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  topBarSave: { fontSize: 14, fontWeight: '600', color: '#0F766E' },
  formScroll: { padding: 20, gap: 16, paddingBottom: 48 },
  productImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  categoryText: { fontSize: 12, fontWeight: '600', color: '#0F766E' },
  fieldGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  titleInput: {
    fontSize: 16,
    color: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
    fontWeight: '600',
  },
  charCount: { fontSize: 11, color: '#94A3B8', textAlign: 'right' },
  descInput: {
    fontSize: 14,
    color: '#0F172A',
    minHeight: 88,
    lineHeight: 22,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceCurrency: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  priceInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#0F766E',
    paddingVertical: 4,
  },
  tagInputRow: { flexDirection: 'row', gap: 8 },
  tagTextInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
  },
  addTagButton: {
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#99F6E4',
    justifyContent: 'center',
  },
  addTagText: { color: '#0F766E', fontWeight: '600', fontSize: 14 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagPillText: { fontSize: 12, fontWeight: '600', color: '#0F766E' },
  featuresToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featuresToggleText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  featuresList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0F766E',
    marginTop: 6,
  },
  featureText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 20 },
  publishStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  statusOption: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  statusActive: { backgroundColor: '#0F766E' },
  statusOptionText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  statusActiveText: { color: '#FFFFFF' },
  publishButton: {
    backgroundColor: '#0F766E',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  publishingRow: {
    backgroundColor: '#0F766E',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    opacity: 0.85,
  },
  publishButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  analyzingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  analyzingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  analyzingSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  errorMsg: { fontSize: 13, color: '#DC2626', textAlign: 'center', lineHeight: 20 },
  retryButton: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  closeButton: { paddingVertical: 8 },
  closeButtonText: { color: '#64748B', fontSize: 14 },
  doneContent: { alignItems: 'center', gap: 16, paddingBottom: 48 },
  doneIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A' },
  doneSubtitle: { fontSize: 15, color: '#64748B', textAlign: 'center' },
  doneImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  doneDetail: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  doneDetailTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  doneDetailDesc: { fontSize: 14, color: '#64748B', lineHeight: 21 },
  doneDetailPrice: { fontSize: 20, fontWeight: '800', color: '#0F766E' },
  adminButton: {
    backgroundColor: '#0F766E',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    justifyContent: 'center',
  },
  adminButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  anotherButton: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  anotherButtonText: { color: '#0F766E', fontSize: 15, fontWeight: '600' },
});
