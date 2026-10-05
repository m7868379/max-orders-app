const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const isAuth = ref(false);
    const pinInput = ref("");
    const orders = ref([]);
    const couriers = ref([]);
    const activeTab = ref("new");
    const orderToPrint = ref(null);

    const courierModalOpen = ref(false);
    const selectedOrderForCourier = ref(null);
    const chosenCourierId = ref(null);

    const playBeep = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(850, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.6, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } catch(e){}
    };

    const loadCouriers = async () => {
      const { data } = await adminDb.from('couriers').select('*').eq('is_active', true);
      couriers.value = data || [];
    };

    const loadOrders = async () => {
      const { data } = await adminDb
        .from('orders')
        .select('*, courier:couriers(*)')
        .order('id', { ascending: false });
      orders.value = data || [];
    };

    const subscribeRealtime = () => {
      adminDb.channel('orders-logistics')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
          await loadOrders();
          if (payload.eventType === 'INSERT') {
            playBeep();
          }
        })
        .subscribe();
    };

    const checkPin = () => {
      if (pinInput.value === OPERATOR_PIN) {
        isAuth.value = true;
        localStorage.setItem('operator_logged_in', 'true');
        loadCouriers();
        loadOrders();
        subscribeRealtime();
      } else {
        alert("Неверный PIN-код!");
        pinInput.value = "";
      }
    };

    const logout = () => {
      isAuth.value = false;
      localStorage.removeItem('operator_logged_in');
    };

    const updateStatus = async (orderId, newStatus, extraData = {}) => {
      const updatePayload = { status: newStatus, ...extraData };
      const { error } = await adminDb.from('orders').update(updatePayload).eq('id', orderId);
      if (!error) {
        await loadOrders();
      }
    };

    const handleActionClick = (order) => {
      if (order.status === 'ready') {
        selectedOrderForCourier.value = order;
        chosenCourierId.value = couriers.value[0]?.id || null;
        courierModalOpen.value = true;
      } else {
        const next = getNextAction(order);
        if (next) {
          const extra = {};
          if (next.nextStatus === 'assembling') extra.assembled_at = new Date().toISOString();
          if (next.nextStatus === 'completed') extra.delivered_at = new Date().toISOString();
          updateStatus(order.id, next.nextStatus, extra);
        }
      }
    };

    const assignCourierAndDispatch = async () => {
      if (!selectedOrderForCourier.value || !chosenCourierId.value) return;
      await updateStatus(selectedOrderForCourier.value.id, 'delivering', {
        courier_id: chosenCourierId.value,
        dispatched_at: new Date().toISOString()
      });
      courierModalOpen.value = false;
    };

    const cancelOrder = (orderId) => {
      if (confirm("Вы точно хотите отменить этот заказ?")) {
        updateStatus(orderId, 'cancelled');
      }
    };

    const logisticsTabs = [
      { status: 'new', name: 'Новые', icon: '🔴' },
      { status: 'assembling', name: 'На сборке', icon: '🟡' },
      { status: 'ready', name: 'Собраны', icon: '🔵' },
      { status: 'delivering', name: 'В пути', icon: '🟣' },
      { status: 'completed', name: 'Вручены', icon: '🟢' },
      { status: 'all', name: 'Все', icon: '📋' }
    ];

    const getCountByStatus = (st) => {
      if (st === 'all') return orders.value.length;
      return orders.value.filter(o => o.status === st).length;
    };

    const filteredOrders = computed(() => {
      if (activeTab.value === 'all') return orders.value;
      return orders.value.filter(o => o.status === activeTab.value);
    });

    const getNextAction = (order) => {
      switch(order.status) {
        case 'new':
          return { label: 'Принять в сборку', nextStatus: 'assembling', icon: '👨‍🍳', btnClass: 'bg-amber-500 hover:bg-amber-600 text-white' };
        case 'assembling':
          return { label: 'Заказ собран (готов к отправке)', nextStatus: 'ready', icon: '📦', btnClass: 'bg-blue-600 hover:bg-blue-700 text-white' };
        case 'ready':
          return { label: 'Назначить курьера и отправить', nextStatus: 'delivering', icon: '🚚', btnClass: 'bg-purple-600 hover:bg-purple-700 text-white' };
        case 'delivering':
          return { label: 'Заказ успешно вручен клиенту', nextStatus: 'completed', icon: '✅', btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white' };
        default:
          return null;
      }
    };

    const getStatusTitle = (st) => {
      return {
        'new': 'Новый заказ',
        'assembling': 'Комплектуется',
        'ready': 'Собран на складе',
        'delivering': 'Курьер в пути',
        'completed': 'Доставлен',
        'cancelled': 'Отменен'
      }[st] || st;
    };

    const getStatusBadgeClass = (st) => {
      return {
        'new': 'bg-rose-100 text-rose-700',
        'assembling': 'bg-amber-100 text-amber-800',
        'ready': 'bg-blue-100 text-blue-800',
        'delivering': 'bg-purple-100 text-purple-800',
        'completed': 'bg-emerald-100 text-emerald-800',
        'cancelled': 'bg-slate-200 text-slate-600'
      }[st] || 'bg-slate-100 text-slate-700';
    };

    const stepOrder = ['new', 'assembling', 'ready', 'delivering', 'completed'];
    const isPassedOrCurrent = (currentStatus, step) => {
      if (currentStatus === 'cancelled') return false;
      return stepOrder.indexOf(currentStatus) >= stepOrder.indexOf(step);
    };

    const getTimeAgo = (ts) => {
      if (!ts) return "";
      const diffMin = Math.floor((new Date() - new Date(ts)) / 60000);
      if (diffMin < 1) return "Только что";
      if (diffMin < 60) return `${diffMin} мин назад`;
      const diffHours = Math.floor(diffMin / 60);
      return `${diffHours} ч назад`;
    };

    const formatDate = (ts) => {
      if (!ts) return "";
      return new Date(ts).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const printOrder = (order) => {
      orderToPrint.value = order;
      setTimeout(() => {
        window.print();
        orderToPrint.value = null;
      }, 150);
    };

    window.onafterprint = () => {
      orderToPrint.value = null;
    };

    onMounted(() => {
      if (localStorage.getItem('operator_logged_in') === 'true') {
        isAuth.value = true;
        loadCouriers();
        loadOrders();
        subscribeRealtime();
      }
    });

    return {
      isAuth, pinInput, checkPin, logout, logisticsTabs, activeTab, filteredOrders,
      couriers, courierModalOpen, selectedOrderForCourier, chosenCourierId,
      getCountByStatus, getNextAction, handleActionClick, assignCourierAndDispatch,
      cancelOrder, getStatusTitle, getStatusBadgeClass, isPassedOrCurrent,
      getTimeAgo, formatDate, printOrder, orderToPrint
    };
  }
}).mount('#app');