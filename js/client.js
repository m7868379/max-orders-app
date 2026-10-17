const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const products = ref([]);
    const loading = ref(true);
    const selectedCategory = ref("Сухари");
    const cart = ref({});
    const showCheckout = ref(false);
    const submitting = ref(false);
    const orderSuccess = ref(false);
    const lastOrderId = ref(null);

    // Новые B2B поля из макета
    const orderForm = ref({
      shopName: '',
      address: '',
      phone: '',
      inn: ''
    });

    const fetchProducts = async () => {
      loading.value = true;
      const { data, error } = await clientDb
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });

      if (!error && data) {
        products.value = data;
        // Если выбранной категории нет, ставим первую доступную
        if (data.length > 0 && !categories.value.includes(selectedCategory.value)) {
          selectedCategory.value = categories.value[0];
        }
      }
      loading.value = false;
    };

    const categories = computed(() => {
      const list = [];
      products.value.forEach(p => {
        if (p.category && !list.includes(p.category)) list.push(p.category);
      });
      return list.length ? list : ["Сухари", "Мясо", "Сыры", "Гренки", "Орехи"];
    });

    const filteredProducts = computed(() => {
      return products.value.filter(p => p.category === selectedCategory.value);
    });

    // Добавление / увеличение
    const addToCart = (item) => {
      if (!cart.value[item.id]) {
        cart.value[item.id] = { item, qty: 1 };
      } else {
        cart.value[item.id].qty++;
      }
    };

    // Уменьшение / удаление
    const removeFromCart = (itemId) => {
      if (cart.value[itemId]) {
        cart.value[itemId].qty--;
        if (cart.value[itemId].qty <= 0) {
          delete cart.value[itemId];
          // Если корзина опустела в окне оформления, возвращаем на витрину
          if (Object.keys(cart.value).length === 0) {
            showCheckout.value = false;
          }
        }
      }
    };

    // Ручной ввод количества в карточке товара
    const onManualInput = (item, event) => {
      const val = parseInt(event.target.value, 10);
      if (isNaN(val) || val <= 0) {
        delete cart.value[item.id];
      } else {
        cart.value[item.id] = { item, qty: val };
      }
    };

    const cartTotalCount = computed(() => Object.values(cart.value).reduce((sum, c) => sum + c.qty, 0));
    const cartTotalPrice = computed(() => Object.values(cart.value).reduce((sum, c) => sum + (c.item.price * c.qty), 0));

    // Отправка B2B-заказа в Supabase
    const submitOrder = async () => {
      if (cartTotalCount.value === 0) return;
      submitting.value = true;

      const orderItems = Object.values(cart.value).map(c => ({
        product_id: c.item.id,
        article: c.item.article,
        name: c.item.name,
        price: c.item.price,
        qty: c.qty,
        subtotal: c.item.price * c.qty
      }));

      // Сохраняем имя магазина и ИНН в customer_name, а адрес в customer_address
      const { error } = await clientDb.from('orders').insert([
        {
          customer_name: `${orderForm.value.shopName} (ИНН: ${orderForm.value.inn})`,
          customer_phone: orderForm.value.phone,
          customer_address: orderForm.value.address,
          comment: `ИНН: ${orderForm.value.inn}`,
          items: orderItems,
          total_amount: cartTotalPrice.value,
          status: 'new'
        }
      ]);

      submitting.value = false;

      if (error) {
        alert('Ошибка при оформлении заявки: ' + error.message);
      } else {
        lastOrderId.value = Math.floor(1000 + Math.random() * 9000);
        orderSuccess.value = true;
        showCheckout.value = false;
        cart.value = {};
        orderForm.value = { shopName: '', address: '', phone: '', inn: '' };
      }
    };

    onMounted(fetchProducts);

    return {
      products, loading, categories, selectedCategory, filteredProducts,
      cart, addToCart, removeFromCart, onManualInput, cartTotalCount,
      cartTotalPrice, showCheckout, orderForm, submitting, submitOrder,
      orderSuccess, lastOrderId
    };
  }
}).mount('#app');