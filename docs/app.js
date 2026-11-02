const CONFIG = window.FLAREMAP_CONFIG || {};

const SUPABASE_URL = CONFIG.SUPABASE_URL || "https://gywjyuzrdkhjpqmvvpgp.supabase.co";
const SUPABASE_KEY = CONFIG.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_9baQ54kcja4cnFhz64QBWg_dKFetGYF";

const hasSupabaseConfig = Boolean(
  SUPABASE_URL &&
  SUPABASE_KEY &&
  !SUPABASE_URL.includes("YOUR-PROJECT-REF") &&
  !SUPABASE_KEY.includes("YOUR_SUPABASE")
);

const supabaseClient = hasSupabaseConfig
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;


// Dashboard elements
const temperatureValue = document.getElementById("temperatureValue");
const humidityValue = document.getElementById("humidityValue");
const gasValue = document.getElementById("gasValue");
const coValue = document.getElementById("coValue");
const connectionStatus = document.getElementById("connectionStatus");
const eventList = document.getElementById("eventList");
const reportForm = document.getElementById("reportForm");
const reportMessage = document.getElementById("reportMessage");
const adminMessage = document.getElementById("adminMessage");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminContent = document.getElementById("adminContent");

const historyCanvas = document.getElementById("historyChart");
const chartContext = historyCanvas?.getContext("2d");

let readings = [];
let currentUser = null;
let isAdmin = false;

const MAX_READINGS = 20;

function showMessage(element, message, type = "success") {
  if (!element) return;

  element.textContent = message;
  element.className = `message show ${type}`;
}

function clearMessage(element) {
  if (!element) return;

  element.textContent = "";
  element.className = "message";
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

// DEMO DATA ONLY.
// These values are simulated and are NOT actual sensor readings.
function generateDemoReading() {
  return {
    temperature: Number((25 + Math.random() * 8).toFixed(1)),
    humidity: Number((45 + Math.random() * 25).toFixed(1)),
    gas: Math.floor(150 + Math.random() * 250),
    co: Math.floor(5 + Math.random() * 20),
    time: new Date()
  };
}

function updateMetric(element, value) {
  if (element) element.textContent = value;
}

function updateDashboard(reading) {
  updateMetric(temperatureValue, reading.temperature);
  updateMetric(humidityValue, reading.humidity);
  updateMetric(gasValue, reading.gas);
  updateMetric(coValue, reading.co);

  readings.push(reading);

  if (readings.length > MAX_READINGS) {
    readings.shift();
  }

  drawChart();
}

function drawChart() {
  if (!historyCanvas || !chartContext) return;

  const width = historyCanvas.clientWidth;
  const height = historyCanvas.clientHeight;
  const pixelRatio = window.devicePixelRatio || 1;

  historyCanvas.width = width * pixelRatio;
  historyCanvas.height = height * pixelRatio;

  chartContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  chartContext.clearRect(0, 0, width, height);

  if (readings.length < 2) return;

  const padding = 30;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const values = readings.map(item => item.temperature);
  const minValue = Math.min(...values) - 2;
  const maxValue = Math.max(...values) + 2;
  const range = Math.max(maxValue - minValue, 1);

  // Grid lines
  chartContext.strokeStyle = "#26364e";
  chartContext.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = padding + (chartHeight / 4) * i;

    chartContext.beginPath();
    chartContext.moveTo(padding, y);
    chartContext.lineTo(width - padding, y);
    chartContext.stroke();
  }

  // Temperature line
  chartContext.strokeStyle = "#ff8a3d";
  chartContext.lineWidth = 3;
  chartContext.lineJoin = "round";
  chartContext.lineCap = "round";
  chartContext.beginPath();

  readings.forEach((item, index) => {
    const x = padding + (index / (readings.length - 1)) * chartWidth;
    const y =
      padding +
      chartHeight -
      ((item.temperature - minValue) / range) * chartHeight;

    if (index === 0) {
      chartContext.moveTo(x, y);
    } else {
      chartContext.lineTo(x, y);
    }
  });

  chartContext.stroke();

  // Data points
  readings.forEach((item, index) => {
    const x = padding + (index / (readings.length - 1)) * chartWidth;
    const y =
      padding +
      chartHeight -
      ((item.temperature - minValue) / range) * chartHeight;

    chartContext.fillStyle = "#ff8a3d";
    chartContext.beginPath();
    chartContext.arc(x, y, 4, 0, Math.PI * 2);
    chartContext.fill();
  });
}

function startDemoMonitoring() {
  const firstReading = generateDemoReading();
  updateDashboard(firstReading);

  setInterval(() => {
    updateDashboard(generateDemoReading());
  }, 5000);
}

// Database connection
async function signInAnonymously() {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient.auth.signInAnonymously();

  if (error) {
    console.error("Anonymous sign-in failed:", error.message);
    return null;
  }

  currentUser = data.user;
  return data.user;
}

// Community incident reports
async function submitReport(event) {
  event.preventDefault();
  clearMessage(reportMessage);

  const formData = new FormData(reportForm);

  const location = String(formData.get("location") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const incidentType = String(formData.get("incidentType") || "other");

  if (!location || !description) {
    showMessage(
      reportMessage,
      "Please provide a location and description.",
      "error"
    );
    return;
  }

  if (!supabaseClient || !currentUser) {
    showMessage(
      reportMessage,
      "Database is not connected yet. Your report was not submitted.",
      "error"
    );
    return;
  }

  const submitButton = reportForm.querySelector("button[type='submit']");
  if (submitButton) submitButton.disabled = true;

  try {
    const { error } = await supabaseClient
      .from("alarm_events")
      .insert({
        user_id: currentUser.id,
        location,
        description,
        event_type: incidentType,
        status: "reported"
      });

    if (error) throw error;

    reportForm.reset();

    showMessage(
      reportMessage,
      "Your community report has been submitted.",
      "success"
    );

    await loadEvents();
  } catch (error) {
    console.error("Report submission failed:", error);

    showMessage(
      reportMessage,
      "Could not submit your report. Please try again.",
      "error"
    );
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

// Recent incident reports
function renderEvents(events) {
  if (!eventList) return;

  if (!events || events.length === 0) {
    eventList.innerHTML =
      '<div class="empty-state">No incident reports yet.</div>';
    return;
  }

  eventList.replaceChildren();

  events.forEach(event => {
    const item = document.createElement("div");
    item.className = "event-item";

    const details = document.createElement("div");

    const title = document.createElement("strong");
    title.textContent = event.location || "Unspecified location";

    const description = document.createElement("small");
    description.textContent = event.description || "No description";

    const time = document.createElement("small");
    time.textContent = event.created_at
      ? new Date(event.created_at).toLocaleString()
      : "Time unavailable";

    const tag = document.createElement("span");
    tag.className = "event-tag";
    tag.textContent = event.status || "reported";

    details.append(title, description, document.createElement("br"), time);
    item.append(details, tag);
    eventList.appendChild(item);
  });
}

async function loadEvents() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("alarm_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Could not load events:", error.message);
    return;
  }

  renderEvents(data);
}

async function checkAdmin(userId) {
  if (!supabaseClient || !userId) return false;

  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Admin check failed:", error.message);
    return false;
  }

  return Boolean(data);
}

async function handleAdminLogin(event) {
  event.preventDefault();
  clearMessage(adminMessage);

  if (!supabaseClient) {
    showMessage(
      adminMessage,
      "Connect your Supabase project first.",
      "error"
    );
    return;
  }

  const email = document.getElementById("adminEmail")?.value.trim();
  const password = document.getElementById("adminPassword")?.value;

  if (!email || !password) {
    showMessage(
      adminMessage,
      "Enter your email and password.",
      "error"
    );
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage(adminMessage, "Login failed. Check your details.", "error");
    return;
  }

  currentUser = data.user;
  isAdmin = await checkAdmin(currentUser.id);

  if (!isAdmin) {
    await supabaseClient.auth.signOut();
    currentUser = null;

    showMessage(
      adminMessage,
      "This account does not have administrator access.",
      "error"
    );
    return;
  }

  if (adminContent) adminContent.classList.add("visible");

  showMessage(adminMessage, "Administrator login successful.", "success");
}

async function handleAdminLogout() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }

  currentUser = null;
  isAdmin = false;

  if (adminContent) adminContent.classList.remove("visible");

  showMessage(adminMessage, "You have logged out.", "success");
}

// Demo alert: saves a test event to the database.
// It does not contact emergency services.
async function sendTestAlert() {
  if (!supabaseClient || !currentUser || !isAdmin) {
    showMessage(
      adminMessage,
      "Log in with an authorized administrator account first.",
      "error"
    );
    return;
  }

  const { error } = await supabaseClient
    .from("alarm_events")
 .insert({
  user_id: currentUser.id,
  location: "FlareMap Demo",
  description: "Administrator-created test alert.",
  incident_type: "test_alert",
  event_type: "test_alert",
  status: "test"
});

  if (error) {
    showMessage(adminMessage, "Could not create the test alert.", "error");
    return;
  }

  showMessage(adminMessage, "Test alert saved successfully.", "success");
  await loadEvents();
}

// Browser push notifications
async function enablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    showMessage(
      adminMessage,
      "This browser does not support push notifications.",
      "error"
    );
    return;
  }

  if (!supabaseClient || !currentUser) {
    showMessage(
      adminMessage,
      "Connect Supabase and sign in first.",
      "error"
    );
    return;
  }

  if (!CONFIG.VAPID_PUBLIC_KEY) {
    showMessage(
      adminMessage,
      "Push notifications have not been configured yet.",
      "error"
    );
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      showMessage(
        adminMessage,
        "Notification permission was not granted.",
        "error"
      );
      return;
    }

    const registration = await navigator.serviceWorker.register("./sw.js");

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(CONFIG.VAPID_PUBLIC_KEY)
    });

    const { error } = await supabaseClient.functions.invoke("flaremap", {
      body: {
        action: "subscribe",
        subscription
      }
    });

    if (error) throw error;

    showMessage(
      adminMessage,
      "Browser notifications enabled.",
      "success"
    );
  } catch (error) {
    console.error("Push setup failed:", error);

    showMessage(
      adminMessage,
      "Could not enable notifications. Check your configuration.",
      "error"
    );
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// Realtime updates
function listenForNewEvents() {
  if (!supabaseClient) return;

  supabaseClient
    .channel("flaremap-events")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "alarm_events"
      },
      () => loadEvents()
    )
    .subscribe();
}

// Connection status
function updateConnectionStatus() {
  if (!connectionStatus) return;

  if (supabaseClient) {
    connectionStatus.textContent = "Database configured";
  } else {
    connectionStatus.textContent = "Demo mode";
  }
}

// Button and form listeners
reportForm?.addEventListener("submit", submitReport);
adminLoginForm?.addEventListener("submit", handleAdminLogin);

document
  .getElementById("adminLogoutBtn")
  ?.addEventListener("click", handleAdminLogout);

document
  .getElementById("testAlertBtn")
  ?.addEventListener("click", sendTestAlert);

document
  .getElementById("enablePushBtn")
  ?.addEventListener("click", enablePushNotifications);

window.addEventListener("resize", drawChart);

// Start application
async function initializeFlareMap() {
  updateConnectionStatus();
  startDemoMonitoring();

  if (!supabaseClient) {
    console.warn("FlareMap is running in demo mode.");
    return;
  }

  const user = await signInAnonymously();

  if (user) {
    await loadEvents();
    listenForNewEvents();
  }
}

initializeFlareMap();