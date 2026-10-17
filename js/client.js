const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const products = ref([]);
    const loading = ref(true);
    const selectedCategory = ref("Все");
    const cart = ref({});
    const showCheckout = ref(false);
    const submitting = ref(false);
    const orderSuccess = ref(false);
    const lastOrderId = ref(null);

    const orderForm = ref({
      storeName: '',
      address: '',
      phone: '',
      inn: ''
    });

    // Загрузка активных товаров
    const fetchProducts = async () => {
      loading.value = true;
      const { data, error } = await clientDb
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });

      if (!error && data) {
        products.value = data;
      }
      loading.value = false;
    };

    const categories = computed(() => {
      const list = ["Все", "Сухари", "Мясо", "Сыры", "Гренки", "Орехи", "Рыба"];
      products.value.forEach(p => {
        if (p.category && !list.includes(p.category)) list.push(p.category);
      });
      return list;
    });

    const filteredProducts = computed(() => {
      if (selectedCategory.value === "Все") return products.value;
      return products.value.filter(p => p.category === selectedCategory.value);
    });

    const getItemQty = (itemId) => {
      return cart.value[itemId]?.qty || 0;
    };

    const addToCart = (item) => {
      if (!cart.value[item.id]) {
        cart.value[item.id] = { item, qty: 1 };
      } else {
        cart.value[item.id].qty++;
      }
    };

    const removeFromCart = (itemId) => {
      if (cart.value[itemId]) {
        cart.value[itemId].qty--;
        if (cart.value[itemId].qty <= 0) {
          delete cart.value[itemId];
        }
      }
    };

    const setItemQty = (item, qty) => {
      const val = parseInt(qty, 10);
      if (isNaN(val) || val <= 0) {
        delete cart.value[item.id];
      } else {
        if (!cart.value[item.id]) {
          cart.value[item.id] = { item, qty: val };
        } else {
          cart.value[item.id].qty = val;
        }
      }
    };

    const cartTotalCount = computed(() => {
      return Object.values(cart.value).reduce((sum, c) => sum + c.qty, 0);
    });

    const cartTotalPrice = computed(() => {
      return Object.values(cart.value).reduce((sum, c) => sum + (c.item.price * c.qty), 0);
    });

    const cartItemsList = computed(() => {
      return Object.values(cart.value);
    });

    const scrollToCatalog = () => {
      const el = document.getElementById('catalog-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    const openCheckout = () => {
      if (cartTotalCount.value === 0) return;
      showCheckout.value = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const closeCheckout = () => {
      showCheckout.value = false;
    };

    const submitOrder = async () => {
      if (cartTotalCount.value === 0) return;
      submitting.value = true;

      const orderItems = Object.values(cart.value).map(c => ({
        product_id: c.item.id,
        article: c.item.article || '',
        name: c.item.name,
        price: c.item.price,
        qty: c.qty,
        subtotal: c.item.price * c.qty
      }));

      // Безопасная вставка без .select() чтобы не нарушать RLS
      const { error } = await clientDb.from('orders').insert([
        {
          customer_name: orderForm.value.storeName || 'Магазин B2B',
          customer_phone: orderForm.value.phone,
          customer_address: orderForm.value.address,
          store_name: orderForm.value.storeName || 'Магазин B2B',
          inn: orderForm.value.inn || '',
          comment: `ИНН: ${orderForm.value.inn || 'Не указан'}`,
          items: orderItems,
          total_amount: cartTotalPrice.value,
          status: 'new'
        }
      ]);

      submitting.value = false;

      if (error) {
        alert('Ошибка оформления: ' + error.message);
      } else {
        lastOrderId.value = Math.floor(1000 + Math.random() * 9000);
        orderSuccess.value = true;
        showCheckout.value = false;
        cart.value = {};
        orderForm.value = { storeName: '', address: '', phone: '', inn: '' };
      }
    };

    onMounted(fetchProducts);

    return {
      products,
      loading,
      categories,
      selectedCategory,
      filteredProducts,
      cart,
      cartItemsList,
      getItemQty,
      addToCart,
      removeFromCart,
      setItemQty,
      cartTotalCount,
      cartTotalPrice,
      showCheckout,
      openCheckout,
      closeCheckout,
      orderForm,
      submitting,
      submitOrder,
      orderSuccess,
      lastOrderId,
      scrollToCatalog
    };
  }
}).mount('#app');