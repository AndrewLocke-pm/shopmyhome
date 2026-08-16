import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Package,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  ShoppingBag,
} from 'lucide-react-native';
import { supabase, Product } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-expo';

function StatusBadge({ status }: { status: Product['shopify_status'] }) {
  if (status === 'published') {
    return (
      <View style={[styles.badge, styles.badgeSuccess]}>
        <CheckCircle2 size={11} color="#059669" />
        <Text style={[styles.badgeText, { color: '#059669' }]}>Published</Text>
      </View>
    );
  }
  if (status === 'failed') {
    return (
      <View style={[styles.badge, styles.badgeError]}>
        <XCircle size={11} color="#DC2626" />
        <Text style={[styles.badgeText, { color: '#DC2626' }]}>Failed</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, styles.badgePending]}>
      <Clock size={11} color="#D97706" />
      <Text style={[styles.badgeText, { color: '#D97706' }]}>Draft</Text>
    </View>
  );
}

function ProductCard({
  item,
  onDelete,
}: {
  item: Product;
  onDelete: (id: string) => void;
}) {
  const handleDelete = useCallback(() => {
    Alert.alert('Delete Product', 'Remove this product from history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
    ]);
  }, [item.id, onDelete]);

  return (
    <View style={styles.card}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Package size={32} color="#CBD5E1" />
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
        <View style={styles.cardFooter}>
          {item.price != null && (
            <Text style={styles.cardPrice}>${Number(item.price).toFixed(2)}</Text>
          )}
          <StatusBadge status={item.shopify_status} />
        </View>
        <Text style={styles.cardDate}>
          {new Date(item.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} hitSlop={8}>
        <Trash2 size={16} color="#94A3B8" />
      </TouchableOpacity>
    </View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useUser();
  const userId = user?.id ?? '';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('clerk_user_id', userId)
      .order('created_at', { ascending: false });
    setProducts((data as Product[]) ?? []);
  }, [userId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleDelete = useCallback(async (id: string) => {
    await supabase.from('products').delete().eq('id', id);
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  if (!loading && products.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <ShoppingBag size={64} color="#CBD5E1" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>No Products Yet</Text>
        <Text style={styles.emptySubtitle}>
          Capture a product photo to get started. AI will identify it and create a listing for Shopify.
        </Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => router.push('/')}
        >
          <Text style={styles.emptyButtonText}>Capture a Product</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Product History</Text>
        <Text style={styles.headerCount}>{products.length} item{products.length !== 1 ? 's' : ''}</Text>
      </View>
      <FlatList
        data={products}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#0F766E" />
        }
        renderItem={({ item }) => (
          <ProductCard item={item} onDelete={handleDelete} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  headerCount: { fontSize: 14, color: '#64748B' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardImage: { width: 96, height: 96 },
  cardImagePlaceholder: {
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1, padding: 12, gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', lineHeight: 20 },
  cardDescription: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  cardPrice: { fontSize: 14, fontWeight: '700', color: '#0F766E' },
  cardDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeSuccess: { backgroundColor: '#D1FAE5' },
  badgeError: { backgroundColor: '#FEE2E2' },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  deleteBtn: { padding: 12, justifyContent: 'flex-start' },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  emptySubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
