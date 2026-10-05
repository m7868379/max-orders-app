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

    const orderForm = ref({ name: '', phone: '', comment: '' });

    // Загрузка активных товаров
    const fetchProducts = async () => {
      loading.value = true;
      const { data, error } = await clientDb
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });

      if (!error) products.value = data || [];
      loading.value = false;
    };

    const categories = computed(() => {
      const list = ["Все"];
      products.value.forEach(p => {
        if (p.category && !list.includes(p.category)) list.push(p.category);
      });
      return list;
    });

    const filteredProducts = computed(() => {
      if (selectedCategory.value === "Все") return products.value;
      return products.value.filter(p => p.category === selectedCategory.value);
    });

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
        if (cart.value[itemId].qty <= 0) delete cart.value[itemId];
      }
    };

    const validateQuantity = (item) => {
      const entry = cart.value[item.id];
      if (!entry || !entry.qty || entry.qty < 1) {
        entry.qty = 1;
      }
    };

    const cartTotalCount = computed(() => Object.values(cart.value).reduce((sum, c) => sum + c.qty, 0));
    const cartTotalPrice = computed(() => Object.values(cart.value).reduce((sum, c) => sum + (c.item.price * c.qty), 0));

    const submitOrder = async () => {
      submitting.value = true;

      const orderItems = Object.values(cart.value).map(c => ({
        product_id: c.item.id,
        article: c.item.article,
        name: c.item.name,
        price: c.item.price,
        qty: c.qty,
        subtotal: c.item.price * c.qty
      }));

      const { error } = await clientDb.from('orders').insert([
        {
          customer_name: orderForm.value.name,
          customer_phone: orderForm.value.phone,
          customer_address: orderForm.value.comment,
          comment: orderForm.value.comment,
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
        orderForm.value = { name: '', phone: '', comment: '' };
      }
    };

    onMounted(fetchProducts);

    return {
      products, loading, categories, selectedCategory, filteredProducts,
      cart, addToCart, removeFromCart, validateQuantity, cartTotalCount,
      cartTotalPrice, showCheckout, orderForm, submitting, submitOrder,
      orderSuccess, lastOrderId
    };
  }
}).mount('#app');