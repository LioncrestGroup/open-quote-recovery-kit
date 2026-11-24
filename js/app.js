"use strict";

const ORK = {
  name: "Open Quote Recovery Kit",
  version: "1.1.0",
  storageKey: "openQuoteRecoveryKit",

  state: {
    quotes: [],
    activities: [],
    settings: {
      businessName: "",
      defaultCurrency: "USD",
      followUpDays: [1, 3, 5, 7]
    }
  },

  dashboardHTML: "",
  currentView: "dashboard",
  editingQuoteId: null,
  editingActivityId: null,
  searchTerm: "",
  statusFilter: "All",
  activitySearchTerm: "",
  activityTypeFilter: "All",

  messageQuoteId: "",
  messageChannel: "WhatsApp",
  messagePurpose: "receipt",
  messageTone: "Professional",
  messageSubject: "",
  messageBody: "",

  maxImportBytes: 5 * 1024 * 1024,

  statuses: [
    "Draft", "Sent", "Follow-up", "Negotiating",
    "Accepted", "Declined", "Expired", "Closed - No Response"
  ],

  currencies: [
    "USD", "GBP", "EUR", "NGN", "CAD",
    "AUD", "NZD", "ZAR", "AED", "INR"
  ],

  channels: ["Phone", "Email", "SMS", "WhatsApp", "Other"],

  activityTypes: [
    "Initial Follow-up", "Phone Call", "Email", "SMS",
    "WhatsApp", "Customer Response", "Negotiation", "Other"
  ],

  activityOutcomes: [
    "No Answer", "Message Sent", "Interested",
    "Requested More Information", "Negotiating",
    "Accepted", "Declined", "Callback Requested",
    "No Further Contact", "Other"
  ],

  messagePurposes: [
    { value: "receipt", label: "Confirm quotation received" },
    { value: "review", label: "Ask if they have reviewed it" },
    { value: "value", label: "Revisit the value of the proposal" },
    { value: "decision", label: "Ask for a decision or update" },
    { value: "information", label: "Respond to a request for information" },
    { value: "callback", label: "Follow up on a requested callback" },
    { value: "negotiation", label: "Continue a negotiation" },
    { value: "final", label: "Final follow-up" }
  ],

  init() {
    this.loadData();

    const main = document.getElementById("main-content");

    if (!main) {
      console.error("Application main-content element was not found.");
      return;
    }

    this.dashboardHTML = main.innerHTML;
    this.bindEvents();
    this.showView("dashboard");

    console.log("Open Quote Recovery Kit initialized.");
  },

  // ==========================================
  // STORAGE
  // ==========================================

  normalizeSettings(raw) {
    const source =
      raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};

    const days = Array.isArray(source.followUpDays)
      ? source.followUpDays
          .map(Number)
          .filter(n => Number.isInteger(n) && n > 0 && n <= 365)
      : [];

    return {
      ...source,
      businessName: String(source.businessName || "").trim(),
      defaultCurrency: this.currencies.includes(source.defaultCurrency)
        ? source.defaultCurrency
        : "USD",
      followUpDays: days.length
        ? [...new Set(days)].sort((a, b) => a - b)
        : [1, 3, 5, 7]
    };
  },

  loadData() {
    try {
      const saved = localStorage.getItem(this.storageKey);

      if (saved) {
        const data = JSON.parse(saved);

        this.state = {
          ...this.state,
          ...data,
          settings: this.normalizeSettings({
            ...this.state.settings,
            ...(data.settings || {})
          })
        };

        if (!Array.isArray(this.state.quotes)) {
          this.state.quotes = [];
        }

        if (!Array.isArray(this.state.activities)) {
          this.state.activities = [];
        }
      }
    } catch (error) {
      console.error("Unable to load saved data:", error);
    }
  },

  saveData() {
  try {
    localStorage.setItem(
      this.storageKey,
      JSON.stringify(this.state)
    );

    if (this.currentView === "dashboard") {
  this.renderDashboard();
}

    // Send the latest quotes and activities to Google Sheets.
    fetch(
      "https://script.google.com/macros/s/AKfycbyzbuwC-X2t0CX7Zt_vegr36PemkIptI2TUCOe5X2nf-P4TDBhhCfk34ABFWIh6fNp_/exec",
      {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "sync",
          quotes: this.state.quotes,
          activities: this.state.activities
        })
      }
    ).catch(function(error) {
      console.error("Google Sheets sync request failed:", error);
    });

    return true;

  } catch (error) {
    alert("Your data could not be saved. Check browser storage.");
    console.error(error);
    return false;
  }
},


  // ==========================================
  // HELPERS
  // ==========================================

  escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  },

  localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },

  isValidDateString(value) {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const date = new Date(`${value}T00:00:00`);

    return !Number.isNaN(date.getTime()) &&
      this.localDateKey(date) === value;
  },

  formatDate(value) {
    if (!value) return "—";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return this.escape(value);
    }

    return date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  },

  // ==========================================
  // EVENTS
  // ==========================================

  bindEvents() {
    document.addEventListener("click", event => {
      const nav = event.target.closest("[data-view]");

      if (nav) {
        this.showView(nav.dataset.view);
        return;
      }

      if (event.target.closest("#add-quote-button")) {
        this.showView("quotes");
        this.openQuoteForm();
        return;
      }

      if (event.target.closest("#new-quote-button")) {
        this.openQuoteForm();
        return;
      }

      const editButton = event.target.closest("[data-edit-quote]");

      if (editButton) {
        this.openQuoteForm(editButton.dataset.editQuote);
        return;
      }

      const deleteButton = event.target.closest("[data-delete-quote]");

      if (deleteButton) {
        this.deleteQuote(deleteButton.dataset.deleteQuote);
        return;
      }

      const suggestButton = event.target.closest("[data-suggest-days]");

      if (suggestButton) {
        this.applyFollowUpSuggestion(Number(suggestButton.dataset.suggestDays));
        return;
      }

      if (event.target.closest("#cancel-quote-button")) {
        this.editingQuoteId = null;
        this.renderQuotes();
        return;
      }

      if (event.target.closest("#new-activity-button")) {
        this.openActivityForm();
        return;
      }

      const editActivityButton =
        event.target.closest("[data-edit-activity]");

      if (editActivityButton) {
        this.openActivityForm(editActivityButton.dataset.editActivity);
        return;
      }

      const deleteActivityButton =
        event.target.closest("[data-delete-activity]");

      if (deleteActivityButton) {
        this.deleteActivity(deleteActivityButton.dataset.deleteActivity);
        return;
      }

      if (event.target.closest("#cancel-activity-button")) {
        this.editingActivityId = null;
        this.renderActivities();
        return;
      }

      if (event.target.closest("#generate-message-button")) {
        this.generateMessage();
        return;
      }

      if (event.target.closest("#copy-message-button")) {
        this.copyMessage();
        return;
      }

      if (event.target.closest("#reset-message-button")) {
        this.resetMessage();
        return;
      }

      if (event.target.closest("#add-quote-from-message")) {
        this.showView("quotes");
        this.openQuoteForm();
      }
    });

    document.addEventListener("submit", event => {
      if (event.target.id === "quote-form") {
        event.preventDefault();
        this.saveQuote(new FormData(event.target));
        return;
      }

      if (event.target.id === "activity-form") {
        event.preventDefault();
        this.saveActivity(new FormData(event.target));
        return;
      }

      if (event.target.id === "settings-form") {
        event.preventDefault();
        this.saveSettings(new FormData(event.target));
      }
    });

    document.addEventListener("input", event => {
      if (event.target.id === "quote-search") {
        this.searchTerm = event.target.value.toLowerCase();
        this.renderQuoteTable();
        return;
      }

      if (event.target.id === "activity-search") {
        this.activitySearchTerm = event.target.value.toLowerCase();
        this.renderActivityTable();
        return;
      }

      if (event.target.id === "message-body") {
        this.messageBody = event.target.value;
        this.updateMessageCharacterCount();
        return;
      }

      if (event.target.id === "message-subject") {
        this.messageSubject = event.target.value;
      }
    });

    document.addEventListener("change", event => {
      if (event.target.id === "quote-status-filter") {
        this.statusFilter = event.target.value;
        this.renderQuoteTable();
        return;
      }

      if (event.target.id === "activity-type-filter") {
        this.activityTypeFilter = event.target.value;
        this.renderActivityTable();
        return;
      }

      if (event.target.id === "activity-quote-id") {
        this.updateActivityCustomerName(event.target.value);
        return;
      }

      if (event.target.id === "message-quote-select") {
        this.messageQuoteId = event.target.value;
        this.clearMessageDraft();
        this.updateMessageQuoteDetails();
        return;
      }

      if (event.target.id === "message-channel") {
        this.messageChannel = event.target.value;
        this.updateMessageChannelDisplay();
        return;
      }

      if (event.target.id === "message-purpose") {
        this.messagePurpose = event.target.value;
        return;
      }

      if (event.target.id === "message-tone") {
        this.messageTone = event.target.value;
        return;
      }

      // Settings file pickers
      if (event.target.id === "import-quotes-file") {
        const file = event.target.files[0];
        if (file) this.importQuotesCSV(file);
        event.target.value = "";
        return;
      }

      if (event.target.id === "import-activities-file") {
        const file = event.target.files[0];
        if (file) this.importActivitiesCSV(file);
        event.target.value = "";
        return;
      }

      if (event.target.id === "restore-backup-file") {
        const file = event.target.files[0];
        if (file) this.restoreBackup(file);
        event.target.value = "";
      }
    });

    // Settings buttons (delegated, so they keep working after re-render)
    document.addEventListener("click", event => {
      const actions = {
        "#export-quotes-csv": () => this.exportQuotesCSV(),
        "#export-activities-csv": () => this.exportActivitiesCSV(),
        "#download-backup": () => this.downloadBackup(),
        "#download-backup-secondary": () => this.downloadBackup(),
        "#import-quotes-button": () =>
          document.getElementById("import-quotes-file")?.click(),
        "#import-activities-button": () =>
          document.getElementById("import-activities-file")?.click(),
        "#restore-backup-button": () =>
          document.getElementById("restore-backup-file")?.click()
      };

      for (const [selector, action] of Object.entries(actions)) {
        if (event.target.closest(selector)) {
          action();
          return;
        }
      }
    });
  },

  
showView(view) {
  const titles = {
    dashboard: "Dashboard",
    quotes: "Quote Register",
    planner: "Follow-up Planner",
    activities: "Activity Log",
    messages: "Message Generator",
    analytics: "Recovery Analytics",
    settings: "Settings"
  };

  if (!titles[view]) return;

  this.currentView = view;

  const pageTitle = document.getElementById("page-title");
  const main = document.getElementById("main-content");

  if (!pageTitle || !main) return;

  pageTitle.textContent = titles[view];

  document.querySelectorAll(".nav-item[data-view]").forEach(item => {
    item.classList.toggle("active", item.dataset.view === view);
  });

  if (view === "dashboard") {
    main.innerHTML = this.dashboardHTML;
    this.renderDashboard();
  } else if (view === "quotes") {
    this.renderQuotes();
  } else if (view === "planner") {
    this.renderPlanner();
  } else if (view === "activities") {
    this.renderActivities();
  } else if (view === "messages") {
    this.renderMessages();
  } else if (view === "analytics") {
    this.renderAnalytics();
  } else if (view === "settings") {
    this.renderSettings();
  } else {
    main.innerHTML = this.getPlaceholder(view, titles[view]);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
},

  
  renderDashboard() {
    const main = document.getElementById("main-content");
    if (!main) return;

    const quotes = Array.isArray(this.state.quotes)
      ? this.state.quotes
      : [];

    const activities = Array.isArray(this.state.activities)
      ? this.state.activities
      : [];

    const closedStatuses = [
      "Accepted",
      "Declined",
      "Expired",
      "Closed - No Response"
    ];

    const outstanding = quotes.filter(
      quote => !closedStatuses.includes(quote.status)
    );

    const dueFollowUps = quotes.filter(quote => {
      const status = this.getFollowUpStatus(quote);
      return status === "Overdue" || status === "Due today";
    });

    const accepted = quotes.filter(
      quote => quote.status === "Accepted"
    );

    // Update the four dashboard figures.
    const setText = (id, value) => {
      const element = main.querySelector(`#${id}`);
      if (element) element.textContent = value;
    };

    setText("total-quotes", quotes.length);
    setText("outstanding-quotes", outstanding.length);
    setText("due-followups", dueFollowUps.length);

    
// Calculate outstanding quotation totals in their original currencies.
const outstandingTotals = {};

outstanding.forEach(quote => {
  const currency = (quote.currency || "USD").toUpperCase();
  const amount = Number(quote.amount) || 0;

  outstandingTotals[currency] =
    (outstandingTotals[currency] || 0) + amount;
});

// Use the currency selected in Settings.
const displayCurrency = (
  this.state.settings.defaultCurrency || "USD"
).toUpperCase();

const updateOutstandingValue = async () => {
  const currencies = Object.keys(outstandingTotals);
  const needsConversion = currencies.some(
    currency => currency !== displayCurrency
  );

  let convertedTotal = 0;

  // No exchange rate is needed if all quotes already use the selected currency.
  if (!needsConversion) {
    convertedTotal = outstandingTotals[displayCurrency] || 0;

    setText(
      "outstanding-value",
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: displayCurrency
      }).format(convertedTotal)
    );

    setText("fx-updated", "No conversion needed");
    return;
  }

  const cacheKey = `ork_fx_rates_${displayCurrency}`;
  let cachedRates = null;
  let rateData = null;

  try {
    cachedRates = JSON.parse(
      localStorage.getItem(cacheKey) || "null"
    );
  } catch (error) {
    console.warn("Could not read saved exchange rates:", error);
  }

  // Reuse cached rates until the provider's next update time.
  if (
    cachedRates &&
    cachedRates.rates &&
    cachedRates.nextUpdateUnix * 1000 > Date.now()
  ) {
    rateData = cachedRates;
  } else {
    try {
      const response = await fetch(
        `https://open.er-api.com/v6/latest/${displayCurrency}`
      );

      if (!response.ok) {
        throw new Error("Exchange rate request failed.");
      }

      const data = await response.json();

      if (data.result !== "success" || !data.rates) {
        throw new Error("Exchange rate data is unavailable.");
      }

      rateData = {
        rates: data.rates,
        lastUpdated: data.time_last_update_utc,
        nextUpdateUnix: data.time_next_update_unix
      };

      localStorage.setItem(
        cacheKey,
        JSON.stringify(rateData)
      );

    } catch (error) {
      console.warn("Using saved exchange rates:", error);

      // Use the previous rate if the API cannot be reached.
      if (cachedRates && cachedRates.rates) {
        rateData = cachedRates;
      } else {
        setText("outstanding-value", "Rate unavailable");
        setText(
          "fx-updated",
          "Connect to the internet to retrieve exchange rates."
        );
        return;
      }
    }
  }

  // Convert every original currency into the selected display currency.
  for (const [currency, amount] of Object.entries(outstandingTotals)) {
    if (currency === displayCurrency) {
      convertedTotal += amount;
    } else {
      const rate = Number(rateData.rates[currency]);

      if (!rate || !Number.isFinite(rate)) {
        setText("outstanding-value", "Conversion unavailable");
        setText(
          "fx-updated",
          `No exchange rate available for ${currency}.`
        );
        return;
      }

      convertedTotal += amount / rate;
    }
  }

  const formattedValue = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: displayCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(convertedTotal);

  setText("outstanding-value", formattedValue);

  setText(
    "fx-updated",
    `Exchange rate updated: ${rateData.lastUpdated || "Saved rate"}`
  );
};

updateOutstandingValue();


    // Keep different currencies separate.
    const currencyTotals = {};

    accepted.forEach(quote => {
      const currency = quote.currency || "USD";
      currencyTotals[currency] =
        (currencyTotals[currency] || 0) +
        (Number(quote.amount) || 0);
    });

    const acceptedValue = Object.entries(currencyTotals)
      .map(([currency, amount]) =>
        this.formatMoney(amount, currency)
      )
      .join(" · ");

    setText(
      "recovered-value",
      acceptedValue || this.formatMoney(0, this.state.settings.defaultCurrency)
    );

    // Safely display user-entered text.
    const escapeHTML = value =>
      String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[character]);

    // Follow-up Priorities.
    const priorityPanel = main.querySelector(
      ".dashboard-grid .panel:first-child .empty-state"
    );

    if (priorityPanel) {
      const priorities = [...dueFollowUps]
        .sort((a, b) =>
          new Date(a.nextFollowUpDate) - new Date(b.nextFollowUpDate)
        )
        .slice(0, 5);

      priorityPanel.innerHTML = priorities.length
        ? `<div class="dashboard-data-list">
            ${priorities.map(quote => `
              <div class="dashboard-data-item">
                <strong>${escapeHTML(quote.customerName)}</strong>
                <p>${escapeHTML(quote.description)}</p>
                <small>
                  ${escapeHTML(this.getFollowUpStatus(quote))}
                  · ${escapeHTML(quote.nextFollowUpDate)}
                </small>
              </div>
            `).join("")}
          </div>`
        : `<div class="empty-icon">◷</div>
           <strong>No follow-ups due right now</strong>
           <p>Scheduled follow-ups requiring attention will appear here.</p>`;
    }

    // Quotation Status.
    const statusPanel = main.querySelector(
      ".dashboard-grid .panel:nth-child(2) .empty-state"
    );

    if (statusPanel) {
      const statusCounts = {};

      quotes.forEach(quote => {
        const status = quote.status || "Unspecified";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const statusRows = Object.entries(statusCounts);

      statusPanel.innerHTML = statusRows.length
        ? `<div class="dashboard-data-list">
            ${statusRows.map(([status, count]) => `
              <div class="dashboard-data-item">
                <strong>${escapeHTML(status)}</strong>
                <span>${count} quotation${count === 1 ? "" : "s"}</span>
              </div>
            `).join("")}
          </div>`
        : `<div class="empty-icon">▥</div>
           <strong>No quotation data yet</strong>
           <p>Your quotation status overview will appear here.</p>`;
    }

    // Recent Activity.
    const recentPanel = main.querySelector(
      ".recent-panel .empty-state"
    );

    if (recentPanel) {
      const recentActivities = [...activities]
        .sort((a, b) =>
          new Date(b.date || 0) - new Date(a.date || 0)
        )
        .slice(0, 5);

      recentPanel.innerHTML = recentActivities.length
        ? `<div class="dashboard-data-list">
            ${recentActivities.map(activity => `
              <div class="dashboard-data-item">
                <strong>${escapeHTML(activity.customerName || "Customer")}</strong>
                <p>${escapeHTML(activity.activityType || "Activity")} 
                  · ${escapeHTML(activity.channel || "")}</p>
                <small>
                  ${escapeHTML(activity.outcome || "")}
                  · ${escapeHTML(activity.date || "")}
                </small>
              </div>
            `).join("")}
          </div>`
        : `<strong>No activity recorded yet</strong>
           <p>Customer interactions will appear here once recorded.</p>`;
    }
  },


  getPlaceholder(view, title) {
    return `
      <section class="page-heading">
        <div>
          <p class="eyebrow">OPEN QUOTE RECOVERY KIT</p>
          <h1>${this.escape(title)}</h1>
          <p class="page-description">
            This workspace will be developed in the next build stage.
          </p>
        </div>
      </section>

      <section class="panel">
        <div class="empty-state">
          <div class="empty-icon">◆</div>
          <strong>${this.escape(title)} is coming next</strong>
          <p>We're building this section step by step.</p>
        </div>
      </section>
    `;
  },

  // ==========================================
  // IDS, MONEY, FOLLOW-UP STATUS
  // ==========================================

  generateQuoteId() {
    const numbers = this.state.quotes.map(q => {
      const match = String(q.id).match(/^Q-(\d+)$/);
      return match ? Number(match[1]) : 0;
    });

    let next = Math.max(0, ...numbers) + 1;
    let id = `Q-${String(next).padStart(4, "0")}`;

    while (this.state.quotes.some(q => q.id === id)) {
      next++;
      id = `Q-${String(next).padStart(4, "0")}`;
    }

    return id;
  },

  generateActivityId() {
    const numbers = this.state.activities.map(activity => {
      const match = String(activity.id || "").match(/^A-(\d+)$/);
      return match ? Number(match[1]) : 0;
    });

    let next = Math.max(0, ...numbers) + 1;
    let id = `A-${String(next).padStart(4, "0")}`;

    while (this.state.activities.some(activity => activity.id === id)) {
      next++;
      id = `A-${String(next).padStart(4, "0")}`;
    }

    return id;
  },

  formatMoney(amount, currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 2
      }).format(Number(amount) || 0);
    } catch {
      return `${currency || "USD"} ${Number(amount || 0).toFixed(2)}`;
    }
  },

  getFollowUpStatus(quote) {
    if (quote.doNotContact) return "Do not contact";

    if ([
      "Accepted", "Declined", "Expired", "Closed - No Response"
    ].includes(quote.status)) {
      return "Closed";
    }

    if (!quote.nextFollowUpDate) return "Not scheduled";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(`${quote.nextFollowUpDate}T00:00:00`);

    if (Number.isNaN(due.getTime())) return "Not scheduled";
    if (due < today) return "Overdue";
    if (due.getTime() === today.getTime()) return "Due today";

    return "Upcoming";
  },

  // ==========================================
  // QUOTE REGISTER
  // ==========================================

  renderQuotes() {
    document.getElementById("main-content").innerHTML = `
      <section class="page-heading">
        <div>
          <p class="eyebrow">CUSTOMER MANAGEMENT</p>
          <h1>Quote Register</h1>
          <p class="page-description">
            Create, organise and monitor your customer quotations.
          </p>
        </div>

        <button class="primary-button" id="new-quote-button">
          + Add New Quote
        </button>
      </section>

      <section class="panel" id="quote-form-container" hidden></section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>All Quotations</h2>
            <p id="quote-count">0 quotations recorded</p>
          </div>
        </div>

        <div class="quote-toolbar">
          <input id="quote-search" type="search"
            placeholder="Search customer, business or Quote ID..."
            value="${this.escape(this.searchTerm)}">

          <select id="quote-status-filter">
            <option value="All">All statuses</option>
            ${this.statuses.map(status => `
              <option value="${status}"
                ${this.statusFilter === status ? "selected" : ""}>
                ${status}
              </option>
            `).join("")}
          </select>
        </div>

        <div class="table-wrap">
          <table class="quote-table">
            <thead>
              <tr>
                <th>Quote ID</th>
                <th>Customer</th>
                <th>Quote Amount</th>
                <th>Date Sent</th>
                <th>Status</th>
                <th>Next Follow-up</th>
                <th>Follow-up Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="quote-table-body"></tbody>
          </table>
        </div>

        <div id="quote-empty" class="empty-state" hidden>
          <div class="empty-icon">▤</div>
          <strong>No quotations found</strong>
          <p>Add your first quotation or change your search filters.</p>
        </div>
      </section>
    `;

    this.renderQuoteTable();
  },

  renderQuoteTable() {
    const body = document.getElementById("quote-table-body");
    if (!body) return;

    const filtered = this.state.quotes.filter(quote => {
      const searchText = [
        quote.id, quote.customerName, quote.businessName,
        quote.description, quote.email, quote.phone
      ].join(" ").toLowerCase();

      return searchText.includes(this.searchTerm) &&
        (this.statusFilter === "All" ||
          quote.status === this.statusFilter);
    });

    document.getElementById("quote-count").textContent =
      `${filtered.length} of ${this.state.quotes.length} quotations`;

    document.getElementById("quote-empty").hidden =
      filtered.length > 0;

    body.innerHTML = "";

    filtered.forEach(quote => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td><strong>${this.escape(quote.id)}</strong></td>
        <td>
          <strong>${this.escape(quote.customerName)}</strong>
          <small>${this.escape(quote.businessName || "")}</small>
        </td>
        <td>${this.formatMoney(quote.amount, quote.currency)}</td>
        <td>${this.escape(quote.dateSent || "—")}</td>
        <td>${this.escape(quote.status)}</td>
        <td>${this.escape(quote.nextFollowUpDate || "—")}</td>
        <td>${this.escape(this.getFollowUpStatus(quote))}</td>
        <td class="quote-actions">
          <button class="small-button"
            data-edit-quote="${this.escape(quote.id)}">Edit</button>
          <button class="small-button delete-button"
            data-delete-quote="${this.escape(quote.id)}">Delete</button>
        </td>
      `;

      body.appendChild(row);
    });
  },

  openQuoteForm(id = null) {
    this.editingQuoteId = id;

    const existing = id
      ? this.state.quotes.find(q => q.id === id)
      : null;

    const quote = existing || {
      customerName: "",
      businessName: "",
      email: "",
      phone: "",
      description: "",
      amount: "",
      currency: this.state.settings.defaultCurrency,
      dateSent: this.localDateKey(),
      expiryDate: "",
      status: "Sent",
      lastContactDate: "",
      nextFollowUpDate: "",
      channel: "Email",
      doNotContact: false,
      assignedTo: "",
      notes: ""
    };

    const intervals = this.state.settings.followUpDays || [1, 3, 5, 7];

    const container = document.getElementById("quote-form-container");
    container.hidden = false;

    container.innerHTML = `
      <div class="panel-heading">
        <div>
          <h2>${existing ? "Edit Quotation" : "Add New Quotation"}</h2>
          <p>${existing ? this.escape(existing.id) :
            "Enter the customer and quotation details below."}</p>
        </div>
      </div>

      <form id="quote-form">
        <div class="quote-form-grid">
          <label>Customer Name *
            <input name="customerName" required
              value="${this.escape(quote.customerName)}">
          </label>

          <label>Business Name
            <input name="businessName"
              value="${this.escape(quote.businessName)}">
          </label>

          <label>Customer Email
            <input name="email" type="email"
              value="${this.escape(quote.email)}">
          </label>

          <label>Customer Phone
            <input name="phone" type="tel"
              value="${this.escape(quote.phone)}">
          </label>

          <label class="wide-field">Quote Description *
            <input name="description" required
              value="${this.escape(quote.description)}">
          </label>

          <label>Quote Amount *
            <input name="amount" type="number" min="0"
              step="0.01" required value="${this.escape(quote.amount)}">
          </label>

          <label>Currency *
            <select name="currency" required>
              ${this.currencies.map(c => `
                <option value="${c}"
                  ${quote.currency === c ? "selected" : ""}>${c}</option>
              `).join("")}
            </select>
          </label>

          <label>Date Sent
            <input name="dateSent" type="date"
              value="${this.escape(quote.dateSent)}">
          </label>

          <label>Quote Expiry Date
            <input name="expiryDate" type="date"
              value="${this.escape(quote.expiryDate)}">
          </label>

          <label>Quote Status
            <select name="status">
              ${this.statuses.map(s => `
                <option value="${s}"
                  ${quote.status === s ? "selected" : ""}>${s}</option>
              `).join("")}
            </select>
          </label>

          <label>Last Contact Date
            <input name="lastContactDate" type="date"
              value="${this.escape(quote.lastContactDate)}">
          </label>

          <label>Next Follow-up Date
            <input name="nextFollowUpDate" type="date"
              value="${this.escape(quote.nextFollowUpDate)}">
          </label>

          <label>Follow-up Channel
            <select name="channel">
              ${this.channels.map(c => `
                <option value="${c}"
                  ${quote.channel === c ? "selected" : ""}>${c}</option>
              `).join("")}
            </select>
          </label>

          <label>Assigned To
            <input name="assignedTo"
              value="${this.escape(quote.assignedTo)}">
          </label>

          <div class="wide-field followup-suggestions">
            <small>Suggest a follow-up date after the Date Sent
              (your default intervals). Nothing is set unless you click:</small>
            <div class="followup-suggestion-buttons">
              ${intervals.map(days => `
                <button type="button" class="small-button"
                  data-suggest-days="${days}">
                  +${days} day${days === 1 ? "" : "s"}
                </button>
              `).join("")}
            </div>
          </div>

          <label class="wide-field">Internal Notes
            <textarea name="notes" rows="3">${this.escape(quote.notes)}</textarea>
          </label>

          <label class="checkbox-field wide-field">
            <input name="doNotContact" type="checkbox"
              ${quote.doNotContact ? "checked" : ""}>
            Do Not Contact — exclude this customer from follow-up priorities
          </label>
        </div>

        <div class="form-actions">
          <button type="button" class="secondary-button"
            id="cancel-quote-button">Cancel</button>
          <button type="submit" class="primary-button">
            Save Quotation
          </button>
        </div>
      </form>
    `;

    container.scrollIntoView({ behavior: "smooth", block: "start" });
  },

  applyFollowUpSuggestion(days) {
    const form = document.getElementById("quote-form");
    if (!form || !Number.isInteger(days)) return;

    const sent = form.elements.dateSent.value || this.localDateKey();
    const base = new Date(`${sent}T00:00:00`);

    if (Number.isNaN(base.getTime())) return;

    base.setDate(base.getDate() + days);
    form.elements.nextFollowUpDate.value = this.localDateKey(base);
  },

  saveQuote(formData) {
    const data = Object.fromEntries(formData.entries());
    data.amount = Number(data.amount);
    data.doNotContact = formData.get("doNotContact") === "on";

    if (!Number.isFinite(data.amount) || data.amount < 0) {
      alert("Enter a valid quotation amount.");
      return;
    }

    const existingIndex = this.state.quotes.findIndex(
      q => q.id === this.editingQuoteId
    );

    if (existingIndex >= 0) {
      this.state.quotes[existingIndex] = {
        ...this.state.quotes[existingIndex],
        ...data
      };
    } else {
      this.state.quotes.push({
        id: this.generateQuoteId(),
        ...data,
        createdAt: new Date().toISOString()
      });
    }

    if (this.saveData()) {
      this.editingQuoteId = null;
      this.renderQuotes();
    }
  },

  deleteQuote(id) {
    const quote = this.state.quotes.find(q => q.id === id);
    if (!quote) return;

    if (!confirm(`Delete quotation ${id} for ${quote.customerName}?`)) {
      return;
    }

    this.state.quotes = this.state.quotes.filter(q => q.id !== id);

    if (this.saveData()) this.renderQuotes();
  },

  // ==========================================
  // ACTIVITY LOG
  // ==========================================

  renderActivities() {
    const main = document.getElementById("main-content");

    main.innerHTML = `
      <section class="page-heading">
        <div>
          <p class="eyebrow">CUSTOMER COMMUNICATION HISTORY</p>
          <h1>Activity Log</h1>
          <p class="page-description">
            Record calls, messages, customer responses and every important
            interaction connected to a quotation.
          </p>
        </div>
        <button class="primary-button" id="new-activity-button">
          + Log Activity
        </button>
      </section>

      <section class="panel" id="activity-form-container" hidden></section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Interaction History</h2>
            <p id="activity-count">0 activities recorded</p>
          </div>
        </div>

        <div class="quote-toolbar">
          <input id="activity-search" type="search"
            placeholder="Search activity, customer or Quote ID..."
            value="${this.escape(this.activitySearchTerm)}">

          <select id="activity-type-filter">
            <option value="All">All activity types</option>
            ${this.activityTypes.map(type => `
              <option value="${this.escape(type)}"
                ${this.activityTypeFilter === type ? "selected" : ""}>
                ${this.escape(type)}
              </option>
            `).join("")}
          </select>
        </div>

        <div class="table-wrap">
          <table class="quote-table activity-table">
            <thead>
              <tr>
                <th>Activity ID</th>
                <th>Date</th>
                <th>Quote ID</th>
                <th>Customer</th>
                <th>Activity Type</th>
                <th>Channel</th>
                <th>Outcome</th>
                <th>Next Follow-up</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="activity-table-body"></tbody>
          </table>
        </div>

        <div id="activity-empty" class="empty-state" hidden>
          <div class="empty-icon">▤</div>
          <strong>No activities found</strong>
          <p>Log your first customer interaction or adjust your search.</p>
        </div>
      </section>
    `;

    this.renderActivityTable();
  },

  renderActivityTable() {
    const body = document.getElementById("activity-table-body");
    if (!body) return;

    const filtered = this.state.activities
      .filter(activity => {
        const searchText = [
          activity.id, activity.quoteId, activity.customerName,
          activity.activityType, activity.channel, activity.outcome,
          activity.nextAction, activity.assignedTo, activity.notes
        ].join(" ").toLowerCase();

        return searchText.includes(this.activitySearchTerm) &&
          (this.activityTypeFilter === "All" ||
            activity.activityType === this.activityTypeFilter);
      })
      .sort((a, b) => {
        const dateCompare = String(b.date || "")
          .localeCompare(String(a.date || ""));

        if (dateCompare !== 0) return dateCompare;

        return String(b.createdAt || "")
          .localeCompare(String(a.createdAt || ""));
      });

    document.getElementById("activity-count").textContent =
      `${filtered.length} of ${this.state.activities.length} activities`;

    document.getElementById("activity-empty").hidden =
      filtered.length > 0;

    body.innerHTML = "";

    filtered.forEach(activity => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td><strong>${this.escape(activity.id)}</strong></td>
        <td>${this.formatDate(activity.date)}</td>
        <td><strong>${this.escape(activity.quoteId)}</strong></td>
        <td>${this.escape(activity.customerName)}</td>
        <td>${this.escape(activity.activityType)}</td>
        <td>${this.escape(activity.channel)}</td>
        <td>${this.escape(activity.outcome)}</td>
        <td>${this.formatDate(activity.nextFollowUpDate)}</td>
        <td class="quote-actions">
          <button class="small-button"
            data-edit-activity="${this.escape(activity.id)}">Edit</button>
          <button class="small-button delete-button"
            data-delete-activity="${this.escape(activity.id)}">Delete</button>
        </td>
      `;

      body.appendChild(row);
    });
  },

  openActivityForm(id = null) {
    this.editingActivityId = id;

    const existing = id
      ? this.state.activities.find(activity => activity.id === id)
      : null;

    if (id && !existing) {
      alert("That activity could not be found.");
      return;
    }

    const activity = existing || {
      date: this.localDateKey(),
      quoteId: "",
      customerName: "",
      activityType: "Initial Follow-up",
      channel: "Phone",
      outcome: "Other",
      nextAction: "",
      nextFollowUpDate: "",
      assignedTo: "",
      notes: ""
    };

    const container =
      document.getElementById("activity-form-container");

    container.hidden = false;

    const quoteOptions = this.state.quotes
      .slice()
      .sort((a, b) =>
        String(a.customerName || "")
          .localeCompare(String(b.customerName || ""))
      )
      .map(quote => `
        <option value="${this.escape(quote.id)}"
          ${activity.quoteId === quote.id ? "selected" : ""}>
          ${this.escape(quote.id)} — ${this.escape(quote.customerName)}
        </option>
      `).join("");

    container.innerHTML = `
      <div class="panel-heading">
        <div>
          <h2>${existing ? "Edit Activity" : "Log New Activity"}</h2>
          <p>${existing ? `Editing ${this.escape(existing.id)}` :
            "Record a customer interaction against an existing quotation."}</p>
        </div>
      </div>

      ${this.state.quotes.length === 0 ? `
        <div class="activity-warning">
          You need at least one quotation in the Quote Register before
          you can log an activity. Add a quotation first.
        </div>
      ` : ""}

      <form id="activity-form">
        <div class="quote-form-grid">
          <label>Quote ID *
            <select name="quoteId" id="activity-quote-id" required>
              <option value="">Select a quotation</option>
              ${quoteOptions}
            </select>
          </label>

          <label>Customer Name
            <input name="customerName" id="activity-customer-name"
              value="${this.escape(activity.customerName)}" readonly
              placeholder="Automatically filled from Quote ID">
          </label>

          <label>Activity Date *
            <input name="date" type="date" required
              value="${this.escape(activity.date)}">
          </label>

          <label>Activity Type *
            <select name="activityType" required>
              ${this.activityTypes.map(type => `
                <option value="${this.escape(type)}"
                  ${activity.activityType === type ? "selected" : ""}>
                  ${this.escape(type)}
                </option>
              `).join("")}
            </select>
          </label>

          <label>Contact Channel *
            <select name="channel" required>
              ${this.channels.map(channel => `
                <option value="${this.escape(channel)}"
                  ${activity.channel === channel ? "selected" : ""}>
                  ${this.escape(channel)}
                </option>
              `).join("")}
            </select>
          </label>

          <label>Outcome *
            <select name="outcome" required>
              ${this.activityOutcomes.map(outcome => `
                <option value="${this.escape(outcome)}"
                  ${activity.outcome === outcome ? "selected" : ""}>
                  ${this.escape(outcome)}
                </option>
              `).join("")}
            </select>
          </label>

          <label class="wide-field">Next Action
            <input name="nextAction"
              placeholder="e.g. Send revised quotation or call next week"
              value="${this.escape(activity.nextAction)}">
          </label>

          <label>Next Follow-up Date
            <input name="nextFollowUpDate" type="date"
              value="${this.escape(activity.nextFollowUpDate)}">
          </label>

          <label>Assigned To
            <input name="assignedTo"
              value="${this.escape(activity.assignedTo)}">
          </label>

          <label class="wide-field">Notes
            <textarea name="notes" rows="4"
              placeholder="Record what happened, what the customer said, and any important details...">${this.escape(activity.notes)}</textarea>
          </label>
        </div>

        <div class="activity-form-note">
          Saving an activity records the interaction in this log. If you
          enter a next follow-up date, the linked quotation's Follow-up
          Planner date will be updated.
        </div>

        <div class="form-actions">
          <button type="button" class="secondary-button"
            id="cancel-activity-button">Cancel</button>
          <button type="submit" class="primary-button"
            ${this.state.quotes.length === 0 ? "disabled" : ""}>
            ${existing ? "Save Changes" : "Save Activity"}
          </button>
        </div>
      </form>
    `;

    const selectedQuote = this.state.quotes.find(
      quote => quote.id === activity.quoteId
    );

    const customerInput =
      document.getElementById("activity-customer-name");

    if (customerInput && selectedQuote) {
      customerInput.value = selectedQuote.customerName || "";
    }

    container.scrollIntoView({ behavior: "smooth", block: "start" });
  },

  updateActivityCustomerName(quoteId) {
    const customerInput =
      document.getElementById("activity-customer-name");

    if (!customerInput) return;

    const quote = this.state.quotes.find(item => item.id === quoteId);

    customerInput.value = quote ? quote.customerName || "" : "";
  },

  saveActivity(formData) {
    const data = Object.fromEntries(formData.entries());

    const quote = this.state.quotes.find(
      item => item.id === data.quoteId
    );

    if (!quote) {
      alert("Select a valid quotation from the Quote Register.");
      return;
    }

    data.customerName = quote.customerName || "";

    if (!data.date) {
      alert("Enter the activity date.");
      return;
    }

    const existingIndex = this.state.activities.findIndex(
      activity => activity.id === this.editingActivityId
    );

    if (existingIndex >= 0) {
      const oldActivity = this.state.activities[existingIndex];

      this.state.activities[existingIndex] = {
        ...oldActivity,
        ...data,
        updatedAt: new Date().toISOString()
      };
    } else {
      this.state.activities.push({
        id: this.generateActivityId(),
        ...data,
        createdAt: new Date().toISOString()
      });
    }

    quote.lastContactDate = data.date;

    if (data.nextFollowUpDate) {
      quote.nextFollowUpDate = data.nextFollowUpDate;
    }

    if (data.channel) quote.channel = data.channel;
    if (data.assignedTo) quote.assignedTo = data.assignedTo;

    if (data.outcome === "Accepted") {
      quote.status = "Accepted";
      quote.nextFollowUpDate = "";
    } else if (data.outcome === "Declined") {
      quote.status = "Declined";
      quote.nextFollowUpDate = "";
    } else if (data.outcome === "No Further Contact") {
      quote.doNotContact = true;
      quote.nextFollowUpDate = "";
    }

    if (this.saveData()) {
      this.editingActivityId = null;
      this.renderActivities();
    }
  },

  deleteActivity(id) {
    const activity = this.state.activities.find(item => item.id === id);
    if (!activity) return;

    if (!confirm(
      `Delete activity ${id} for ${activity.customerName}?`
    )) {
      return;
    }

    this.state.activities = this.state.activities.filter(
      item => item.id !== id
    );

    if (this.saveData()) this.renderActivities();
  },

  // ==========================================
  // MESSAGE GENERATOR
  // ==========================================

  renderMessages() {
    const main = document.getElementById("main-content");

    const quoteOptions = this.state.quotes
      .slice()
      .sort((a, b) =>
        String(a.customerName || "")
          .localeCompare(String(b.customerName || ""))
      )
      .map(quote => `
        <option value="${this.escape(quote.id)}"
          ${this.messageQuoteId === quote.id ? "selected" : ""}>
          ${this.escape(quote.id)} — ${this.escape(quote.customerName)}
        </option>
      `).join("");

    const selectedQuote = this.state.quotes.find(
      quote => quote.id === this.messageQuoteId
    );

    const blocked = selectedQuote
      ? this.isMessageBlocked(selectedQuote)
      : false;

    main.innerHTML = `
      <section class="page-heading">
        <div>
          <p class="eyebrow">CUSTOMER COMMUNICATION SUPPORT</p>
          <h1>Message Generator</h1>
          <p class="page-description">
            Prepare personalised quotation follow-up messages using
            information already stored in your Quote Register.
          </p>
        </div>
      </section>

      <section class="panel message-generator-panel">
        <div class="panel-heading">
          <div>
            <h2>Build Your Message</h2>
            <p>Select a quotation and customise the message before generating it.</p>
          </div>
        </div>

        ${this.state.quotes.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">✉</div>
            <strong>No quotations available yet</strong>
            <p>Add a quotation to your Quote Register before creating a personalised message.</p>
            <button class="primary-button" id="add-quote-from-message">
              + Add a Quotation
            </button>
          </div>
        ` : `
          <div class="message-form-grid">

            <label>Choose Quotation *
              <select id="message-quote-select">
                <option value="">Select a quotation</option>
                ${quoteOptions}
              </select>
            </label>

            <label>Contact Channel *
              <select id="message-channel">
                <option value="WhatsApp"
                  ${this.messageChannel === "WhatsApp" ? "selected" : ""}>
                  WhatsApp
                </option>
                <option value="Email"
                  ${this.messageChannel === "Email" ? "selected" : ""}>
                  Email
                </option>
                <option value="SMS"
                  ${this.messageChannel === "SMS" ? "selected" : ""}>
                  SMS
                </option>
                <option value="Phone"
                  ${this.messageChannel === "Phone" ? "selected" : ""}>
                  Phone Call Script
                </option>
              </select>
            </label>

            <label>Message Purpose *
              <select id="message-purpose">
                ${this.messagePurposes.map(purpose => `
                  <option value="${purpose.value}"
                    ${this.messagePurpose === purpose.value ? "selected" : ""}>
                    ${this.escape(purpose.label)}
                  </option>
                `).join("")}
              </select>
            </label>

            <label>Message Tone *
              <select id="message-tone">
                <option value="Professional"
                  ${this.messageTone === "Professional" ? "selected" : ""}>
                  Professional
                </option>
                <option value="Friendly"
                  ${this.messageTone === "Friendly" ? "selected" : ""}>
                  Friendly
                </option>
                <option value="Concise"
                  ${this.messageTone === "Concise" ? "selected" : ""}>
                  Concise
                </option>
              </select>
            </label>
          </div>

          <div id="message-quote-details" class="message-quote-details">
            ${selectedQuote ? this.getMessageQuoteDetails(selectedQuote) :
              `<p>Select a quotation to see its customer and quote details here.</p>`}
          </div>

          <div id="message-warning" class="message-warning"
            ${blocked ? "" : "hidden"}>
            ${selectedQuote && blocked
              ? this.getMessageBlockReason(selectedQuote)
              : ""}
          </div>

          <div class="message-generator-actions">
            <button type="button" class="primary-button"
              id="generate-message-button">
              Generate Message
            </button>
            <button type="button" class="secondary-button"
              id="reset-message-button">
              Reset Draft
            </button>
          </div>

          <div class="message-output-section">
            <div class="panel-heading">
              <div>
                <h2>Message Draft</h2>
                <p>Review and edit the generated message before using it.</p>
              </div>
              <span class="message-draft-status" id="message-draft-status">
                ${this.messageBody ? "Draft ready" : "No draft generated"}
              </span>
            </div>

            <div id="message-subject-wrap"
              ${this.messageChannel === "Email" ? "" : "hidden"}>
              <label for="message-subject">Email Subject</label>
              <input id="message-subject"
                placeholder="Email subject will appear here"
                value="${this.escape(this.messageSubject)}">
            </div>

            <label for="message-body" class="message-body-label">
              ${this.messageChannel === "Phone"
                ? "Call Script / Talking Points"
                : "Message Body"}
            </label>

            <textarea id="message-body" rows="12"
              placeholder="Your generated message will appear here. You can edit it before copying."
            >${this.escape(this.messageBody)}</textarea>

            <div class="message-output-footer">
              <span id="message-character-count">
                ${this.messageBody.length} characters
              </span>
              <button type="button" class="primary-button"
                id="copy-message-button"
                ${this.messageBody ? "" : "disabled"}>
                Copy Message
              </button>
            </div>
          </div>
        `}

        <div class="message-generator-note">
          <strong>Important:</strong> This tool prepares messages only.
          It does not send emails, SMS or WhatsApp messages. Review the
          draft, copy it, send it through your chosen channel, and then
          record the actual interaction in the Activity Log.
        </div>
      </section>
    `;

    this.updateMessageChannelDisplay();
    this.updateMessageCharacterCount();
  },

  getMessageQuoteDetails(quote) {
    return `
      <div class="message-detail-item">
        <span>Customer</span>
        <strong>${this.escape(quote.customerName || "Not provided")}</strong>
      </div>
      <div class="message-detail-item">
        <span>Quote ID</span>
        <strong>${this.escape(quote.id)}</strong>
      </div>
      <div class="message-detail-item">
        <span>Quotation Value</span>
        <strong>${this.formatMoney(quote.amount, quote.currency)}</strong>
      </div>
      <div class="message-detail-item">
        <span>Quote Status</span>
        <strong>${this.escape(quote.status || "Not specified")}</strong>
      </div>
      <div class="message-detail-item">
        <span>Email</span>
        <strong>${this.escape(quote.email || "Not provided")}</strong>
      </div>
      <div class="message-detail-item">
        <span>Phone</span>
        <strong>${this.escape(quote.phone || "Not provided")}</strong>
      </div>
    `;
  },

  updateMessageQuoteDetails() {
    const quote = this.state.quotes.find(
      item => item.id === this.messageQuoteId
    );

    const details = document.getElementById("message-quote-details");
    const warning = document.getElementById("message-warning");

    if (!details) return;

    details.innerHTML = quote
      ? this.getMessageQuoteDetails(quote)
      : "<p>Select a quotation to see its customer and quote details here.</p>";

    if (warning) {
      const blocked = quote && this.isMessageBlocked(quote);
      warning.hidden = !blocked;
      warning.textContent = blocked
        ? this.getMessageBlockReason(quote)
        : "";
    }
  },

  isMessageBlocked(quote) {
    return Boolean(
      quote.doNotContact ||
      ["Accepted", "Declined", "Expired", "Closed - No Response"]
        .includes(quote.status)
    );
  },

  getMessageBlockReason(quote) {
    if (quote.doNotContact) {
      return "This customer is marked Do Not Contact. Do not generate or send a follow-up message.";
    }

    if (quote.status === "Declined") {
      return "This quotation has been declined. Follow-up messages are disabled for this quotation.";
    }

    if (quote.status === "Accepted") {
      return "This quotation has been accepted and is no longer an outstanding quotation for recovery follow-up.";
    }

    if (quote.status === "Expired") {
      return "This quotation has expired. Review the quotation and update its status before creating a follow-up.";
    }

    return "This quotation is closed. Review its status before creating a follow-up.";
  },

  updateMessageChannelDisplay() {
    const subjectWrap = document.getElementById("message-subject-wrap");
    const bodyLabel = document.querySelector(".message-body-label");
    const body = document.getElementById("message-body");

    if (subjectWrap) {
      subjectWrap.hidden = this.messageChannel !== "Email";
    }

    if (bodyLabel) {
      bodyLabel.textContent = this.messageChannel === "Phone"
        ? "Call Script / Talking Points"
        : "Message Body";
    }

    if (body) {
      body.placeholder = this.messageChannel === "Phone"
        ? "Your call script will appear here."
        : "Your generated message will appear here. You can edit it before copying.";
    }
  },

  clearMessageDraft() {
    this.messageSubject = "";
    this.messageBody = "";

    const subject = document.getElementById("message-subject");
    const body = document.getElementById("message-body");
    const status = document.getElementById("message-draft-status");
    const copyButton = document.getElementById("copy-message-button");

    if (subject) subject.value = "";
    if (body) body.value = "";
    if (status) status.textContent = "No draft generated";
    if (copyButton) copyButton.disabled = true;

    this.updateMessageCharacterCount();
  },

  resetMessage() {
    this.clearMessageDraft();
    this.messagePurpose = "receipt";
    this.messageTone = "Professional";

    const purpose = document.getElementById("message-purpose");
    const tone = document.getElementById("message-tone");

    if (purpose) purpose.value = this.messagePurpose;
    if (tone) tone.value = this.messageTone;
  },

  generateMessage() {
    const quote = this.state.quotes.find(
      item => item.id === this.messageQuoteId
    );

    if (!quote) {
      alert("Please select a quotation first.");
      return;
    }

    if (this.isMessageBlocked(quote)) {
      alert(this.getMessageBlockReason(quote));
      return;
    }

    if (!quote.customerName || !quote.customerName.trim()) {
      alert("This quotation does not have a customer name. Please update it in the Quote Register first.");
      return;
    }

    const customer = quote.customerName.trim();
    const business = this.state.settings.businessName || "our team";
    const description = quote.description || "the quotation";
    const amount = this.formatMoney(quote.amount, quote.currency);
    const quoteId = quote.id;
    const channel = this.messageChannel;
    const tone = this.messageTone;
    const purpose = this.messagePurpose;

    const firstName = customer.split(/\s+/)[0];
    const isEmail = channel === "Email";
    const isPhone = channel === "Phone";

    const greeting = tone === "Concise"
      ? `Hello ${firstName},`
      : tone === "Friendly"
        ? `Hi ${firstName},`
        : `Dear ${firstName},`;

    const signoff = tone === "Friendly"
      ? `Thanks,\n${business}`
      : tone === "Concise"
        ? `Regards,\n${business}`
        : `Kind regards,\n${business}`;

    const details = `quotation ${quoteId} for ${description} (${amount})`;

    const messages = {
      receipt: {
        subject: `Following up on quotation ${quoteId}`,
        professional:
          `${greeting}\n\nI hope you are doing well. I am following up to confirm that you received our ${details}.\n\nPlease let us know if it reached you successfully or if you would like us to resend any information.\n\n${signoff}`,
        friendly:
          `${greeting}\n\nI hope you're doing well! I just wanted to check that you received our ${details}.\n\nPlease let me know if everything came through okay or if you'd like me to send it again.\n\n${signoff}`,
        concise:
          `${greeting}\n\nCould you please confirm receipt of our ${details}?\n\nLet us know if you need us to resend it.\n\n${signoff}`,
        phone:
          `CALL OBJECTIVE: Confirm the customer received the quotation.\n\n1. Introduce yourself and your business.\n2. Ask whether they received quotation ${quoteId} for ${description}.\n3. Confirm whether they have had an opportunity to open or review it.\n4. Ask if they need the quotation resent or require clarification.\n5. Agree on a suitable next step.\n\nSuggested opening:\n${greeting} This is ${business}. I'm calling to confirm that you received our quotation for ${description}.`
      },

      review: {
        subject: `Checking in on quotation ${quoteId}`,
        professional:
          `${greeting}\n\nI wanted to follow up on our ${details} and ask whether you have had an opportunity to review it.\n\nIf you have any questions or would like clarification on any part of the proposal, I would be happy to assist.\n\n${signoff}`,
        friendly:
          `${greeting}\n\nJust checking in to see if you've had a chance to look over our ${details}.\n\nIf anything is unclear or you'd like to talk it through, I'm happy to help.\n\n${signoff}`,
        concise:
          `${greeting}\n\nHave you had a chance to review our ${details}?\n\nPlease let me know if you have any questions.\n\n${signoff}`,
        phone:
          `CALL OBJECTIVE: Find out whether the customer has reviewed the quotation.\n\n1. Ask if they have reviewed quotation ${quoteId}.\n2. Ask whether the proposal meets their requirements.\n3. Invite questions or concerns.\n4. Agree on a next step or follow-up date.\n\nSuggested opening:\n${greeting} I'm calling to check whether you've had a chance to review our quotation for ${description}.`
      },

      value: {
        subject: `A quick follow-up on your proposal`,
        professional:
          `${greeting}\n\nI wanted to revisit our ${details} and see whether the proposed solution aligns with what you are looking to achieve.\n\nIf there are particular requirements or priorities you would like us to address, please let us know. We would welcome the opportunity to clarify how the proposal can support your needs.\n\n${signoff}`,
        friendly:
          `${greeting}\n\nI wanted to check back in about our ${details}.\n\nI'd be glad to talk through how the proposed solution fits your needs and answer any questions you may have. If there's anything you'd like us to adjust or explain, just let me know.\n\n${signoff}`,
        concise:
          `${greeting}\n\nI'm following up on our ${details}. Does the proposed solution meet your current needs?\n\nLet me know if you'd like to discuss any adjustments.\n\n${signoff}`,
        phone:
          `CALL OBJECTIVE: Revisit the customer's needs and the value of the proposal.\n\n1. Ask whether the proposal addresses their main requirements.\n2. Identify any missing requirements or concerns.\n3. Explain relevant benefits already included in the quotation. Do not promise benefits that were not offered.\n4. Ask whether a clarification or revision would help.\n\nSuggested opening:\n${greeting} I'd like to briefly revisit our quotation and make sure the proposed solution is aligned with what you need.`
      },

      decision: {
        subject: `Next steps for quotation ${quoteId}`,
        professional:
          `${greeting}\n\nI am checking in regarding our ${details}.\n\nCould you let us know where things currently stand? If you are ready to proceed, need additional time, or would like to discuss anything before making a decision, we would be pleased to hear from you.\n\n${signoff}`,
        friendly:
          `${greeting}\n\nJust touching base about our ${details}. Have you had a chance to decide how you'd like to move forward?\n\nNo problem if you need more time. If there's anything you'd like to discuss first, I'm happy to help.\n\n${signoff}`,
        concise:
          `${greeting}\n\nCould you share an update on quotation ${quoteId}?\n\nPlease let us know if you wish to proceed, need more time, or have any questions.\n\n${signoff}`,
        phone:
          `CALL OBJECTIVE: Ask for a clear update or decision.\n\n1. Refer to quotation ${quoteId}.\n2. Ask whether the customer is ready to proceed.\n3. If not, ask whether they need more time or have a concern.\n4. Respect their decision and record the outcome.\n\nSuggested opening:\n${greeting} I'm calling to get an update on our quotation. Have you decided how you'd like to proceed?`
      },

      information: {
        subject: `Information regarding quotation ${quoteId}`,
        professional:
          `${greeting}\n\nThank you for your questions regarding our ${details}.\n\nWe would be happy to provide further clarification. Please let us know which specific details you would like us to explain so that we can give you an accurate response.\n\n${signoff}`,
        friendly:
          `${greeting}\n\nThanks for getting back to us about the quotation!\n\nI'd be happy to clarify anything that isn't clear. Just let me know which part you'd like more information about, and I'll help.\n\n${signoff}`,
        concise:
          `${greeting}\n\nThank you for your question about quotation ${quoteId}. Please let me know which details you would like clarified, and I'll be happy to help.\n\n${signoff}`,
        phone:
          `CALL OBJECTIVE: Understand and respond to the customer's information request.\n\n1. Ask what information they need.\n2. Listen carefully and clarify the question.\n3. Do not guess or promise information you cannot verify.\n4. Explain what you can accurately confirm.\n5. If further checking is required, agree on when you will respond.\n\nSuggested opening:\n${greeting} I'm following up on your question about quotation ${quoteId}. Could you tell me which details you'd like us to clarify?`
      },

      callback: {
        subject: `Following up on your callback request`,
        professional:
          `${greeting}\n\nI am following up on your request for a callback regarding quotation ${quoteId}.\n\nPlease let us know if this is still a convenient time to discuss the proposal or suggest a time that works better for you.\n\n${signoff}`,
        friendly:
          `${greeting}\n\nI'm getting back to you as requested about quotation ${quoteId}.\n\nIs now a good time to talk, or would another time be more convenient?\n\n${signoff}`,
        concise:
          `${greeting}\n\nI'm following up on your callback request about quotation ${quoteId}. Is now a convenient time to speak?\n\n${signoff}`,
        phone:
          `CALL OBJECTIVE: Return the customer's requested callback.\n\n1. Identify yourself and refer to their callback request.\n2. Confirm whether now is a convenient time.\n3. Ask what they would like to discuss about quotation ${quoteId}.\n4. Record the conversation and any agreed next step.\n\nSuggested opening:\n${greeting} I'm returning your requested call regarding quotation ${quoteId}. Is now a convenient time?`
      },

      negotiation: {
        subject: `Following up on our discussion about quotation ${quoteId}`,
        professional:
          `${greeting}\n\nThank you for discussing our ${details} with us.\n\nI would like to follow up on the points we discussed and understand whether there are any remaining questions or items that need clarification before you make a decision.\n\nPlease let us know how you would like to proceed.\n\n${signoff}`,
        friendly:
          `${greeting}\n\nThanks for taking the time to discuss our quotation with us.\n\nI wanted to check whether you've had any further thoughts about the points we discussed or if there's anything else you'd like to work through together.\n\n${signoff}`,
        concise:
          `${greeting}\n\nI'm following up on our discussion about quotation ${quoteId}. Are there any remaining points you'd like us to clarify before moving forward?\n\n${signoff}`,
        phone:
          `CALL OBJECTIVE: Continue the existing negotiation constructively.\n\n1. Recap the points already discussed.\n2. Ask which items remain unresolved.\n3. Clarify what can and cannot be changed.\n4. Do not offer an unapproved discount or commitment.\n5. Agree on the next action.\n\nSuggested opening:\n${greeting} I'm following up on our previous discussion about quotation ${quoteId}. I'd like to see whether there are any remaining points we can clarify.`
      },

      final: {
        subject: `Final follow-up regarding quotation ${quoteId}`,
        professional:
          `${greeting}\n\nI am making one final follow-up regarding our ${details}.\n\nIf you are still considering the proposal, please let us know whether you need additional information or time. If your plans have changed, we would also appreciate a brief update so that we can keep our records accurate.\n\nThank you for your time and consideration.\n\n${signoff}`,
        friendly:
          `${greeting}\n\nI'm checking in one last time about our ${details}.\n\nIf you're still interested, we'd be happy to help with any questions. If your plans have changed, that's absolutely fine too — a quick update would help us keep everything up to date.\n\nThanks for your time!\n\n${signoff}`,
        concise:
          `${greeting}\n\nThis is our final follow-up regarding quotation ${quoteId}. Please let us know if you wish to proceed or if your plans have changed.\n\nThank you for your time.\n\n${signoff}`,
        phone:
          `CALL OBJECTIVE: Make a respectful final attempt to establish the quotation's status.\n\n1. Refer to quotation ${quoteId}.\n2. Ask whether the customer is still considering the proposal.\n3. Ask whether they would like to proceed, need more time, or have decided not to proceed.\n4. Respect their response. Do not pressure them.\n5. Update the quotation status and stop further follow-up if they decline or request no contact.\n\nSuggested opening:\n${greeting} I'm making a final check-in about quotation ${quoteId}. I wanted to see whether this is still something you're considering.`
      }
    };

    const selected = messages[purpose];

    if (!selected) {
      alert("Please select a valid message purpose.");
      return;
    }

    const toneKey = tone.toLowerCase();
    this.messageSubject = isEmail ? selected.subject : "";
    this.messageBody = isPhone
      ? selected.phone
      : selected[toneKey];

    const subjectInput = document.getElementById("message-subject");
    const bodyInput = document.getElementById("message-body");
    const status = document.getElementById("message-draft-status");
    const copyButton = document.getElementById("copy-message-button");

    if (subjectInput) subjectInput.value = this.messageSubject;
    if (bodyInput) bodyInput.value = this.messageBody;
    if (status) status.textContent = "Draft ready — review before sending";
    if (copyButton) copyButton.disabled = false;

    this.updateMessageChannelDisplay();
    this.updateMessageCharacterCount();
  },

  updateMessageCharacterCount() {
    const body = document.getElementById("message-body");
    const counter = document.getElementById("message-character-count");

    if (body && counter) {
      counter.textContent = `${body.value.length} characters`;
    }
  },

  async copyMessage() {
    const body = document.getElementById("message-body");
    const subject = document.getElementById("message-subject");

    if (!body || !body.value.trim()) {
      alert("Generate or write a message before copying.");
      return;
    }

    this.messageBody = body.value;

    if (subject) {
      this.messageSubject = subject.value;
    }

    let textToCopy = this.messageBody;

    if (this.messageChannel === "Email" && this.messageSubject.trim()) {
      textToCopy =
        `Subject: ${this.messageSubject.trim()}\n\n${this.messageBody}`;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const temporary = document.createElement("textarea");
        temporary.value = textToCopy;
        temporary.style.position = "fixed";
        temporary.style.opacity = "0";
        document.body.appendChild(temporary);
        temporary.select();

        const successful = document.execCommand("copy");
        temporary.remove();

        if (!successful) {
          throw new Error("Clipboard copy was not successful.");
        }
      }

      alert("Message copied. You can now paste it into your chosen channel.");
    } catch (error) {
      console.error("Unable to copy message:", error);
      alert("The message could not be copied automatically. Please select the text and copy it manually.");
    }
  },

  // ==========================================
  // RECOVERY ANALYTICS
  // ==========================================

  getAnalyticsData() {
    const quotes = this.state.quotes;
    const activities = this.state.activities;

    const closedStatuses = [
      "Accepted",
      "Declined",
      "Expired",
      "Closed - No Response"
    ];

    const accepted = quotes.filter(q => q.status === "Accepted");
    const declined = quotes.filter(q => q.status === "Declined");

    const outstanding = quotes.filter(q =>
      !closedStatuses.includes(q.status)
    );

    const decidedCount = accepted.length + declined.length;

    const currencyTotals = {};

    quotes.forEach(quote => {
      const currency = quote.currency || this.state.settings.defaultCurrency || "USD";
      const amount = Number(quote.amount) || 0;

      if (!currencyTotals[currency]) {
        currencyTotals[currency] = {
          quoted: 0,
          outstanding: 0,
          accepted: 0,
          declined: 0
        };
      }

      currencyTotals[currency].quoted += amount;

      if (!closedStatuses.includes(quote.status)) {
        currencyTotals[currency].outstanding += amount;
      }

      if (quote.status === "Accepted") {
        currencyTotals[currency].accepted += amount;
      }

      if (quote.status === "Declined") {
        currencyTotals[currency].declined += amount;
      }
    });

    const statusTotals = this.statuses.map(status => ({
      status,
      count: quotes.filter(q => q.status === status).length
    })).filter(item => item.count > 0);

    const outcomeTotals = this.activityOutcomes.map(outcome => ({
      outcome,
      count: activities.filter(a => a.outcome === outcome).length
    })).filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);

    const now = new Date();
    const monthlyTotals = [];

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1
      );

      const year = monthDate.getFullYear();
      const month = String(monthDate.getMonth() + 1).padStart(2, "0");
      const key = `${year}-${month}`;

      const monthQuotes = quotes.filter(q =>
        String(q.dateSent || "").startsWith(key)
      );

      monthlyTotals.push({
        key,
        label: monthDate.toLocaleDateString(undefined, {
          month: "short",
          year: "numeric"
        }),
        quoted: monthQuotes.length,
        accepted: monthQuotes.filter(q => q.status === "Accepted").length
      });
    }

    return {
      total: quotes.length,
      accepted: accepted.length,
      declined: declined.length,
      outstanding: outstanding.length,
      decidedCount,
      recoveryRate: decidedCount
        ? (accepted.length / decidedCount) * 100
        : 0,
      activityCount: activities.length,
      currencyTotals,
      statusTotals,
      outcomeTotals,
      monthlyTotals
    };
  },

  renderAnalytics() {
    const main = document.getElementById("main-content");
    if (!main) return;

    const data = this.getAnalyticsData();

    const currencyRows = Object.entries(data.currencyTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, totals]) => `
        <tr>
          <td><strong>${this.escape(currency)}</strong></td>
          <td>${this.formatMoney(totals.quoted, currency)}</td>
          <td>${this.formatMoney(totals.outstanding, currency)}</td>
          <td>${this.formatMoney(totals.accepted, currency)}</td>
          <td>${this.formatMoney(totals.declined, currency)}</td>
        </tr>
      `).join("");

    const maxStatus = Math.max(
      1,
      ...data.statusTotals.map(item => item.count)
    );

    const statusRows = data.statusTotals.map(item => `
      <div class="analytics-bar-item">
        <div class="analytics-bar-heading">
          <span>${this.escape(item.status)}</span>
          <strong>${item.count}</strong>
        </div>
        <div class="analytics-track">
          <div class="analytics-bar"
            style="width:${(item.count / maxStatus) * 100}%"></div>
        </div>
      </div>
    `).join("");

    const maxOutcome = Math.max(
      1,
      ...data.outcomeTotals.map(item => item.count)
    );

    const outcomeRows = data.outcomeTotals.map(item => `
      <div class="analytics-bar-item">
        <div class="analytics-bar-heading">
          <span>${this.escape(item.outcome)}</span>
          <strong>${item.count}</strong>
        </div>
        <div class="analytics-track">
          <div class="analytics-bar analytics-bar-gold"
            style="width:${(item.count / maxOutcome) * 100}%"></div>
        </div>
      </div>
    `).join("");

    const maxMonthly = Math.max(
      1,
      ...data.monthlyTotals.map(item => item.quoted)
    );

    const monthlyRows = data.monthlyTotals.map(item => `
      <div class="analytics-month-row">
        <div class="analytics-month-label">
          <strong>${this.escape(item.label)}</strong>
          <span>${item.quoted} quotation${item.quoted === 1 ? "" : "s"}
            · ${item.accepted} accepted</span>
        </div>
        <div class="analytics-track">
          <div class="analytics-bar"
            style="width:${(item.quoted / maxMonthly) * 100}%"></div>
        </div>
      </div>
    `).join("");

    main.innerHTML = `
      <section class="page-heading">
        <div>
          <p class="eyebrow">BUSINESS PERFORMANCE</p>
          <h1>Recovery Analytics</h1>
          <p class="page-description">
            Understand quotation outcomes, outstanding opportunities
            and customer follow-up activity.
          </p>
        </div>
      </section>

      <section class="analytics-summary-grid">
        <div class="analytics-summary-card">
          <span>Total Quotations</span>
          <strong>${data.total}</strong>
          <small>All quotations recorded</small>
        </div>

        <div class="analytics-summary-card">
          <span>Outstanding Quotes</span>
          <strong>${data.outstanding}</strong>
          <small>Not yet in a closed status</small>
        </div>

        <div class="analytics-summary-card">
          <span>Accepted Quotes</span>
          <strong>${data.accepted}</strong>
          <small>Successfully converted</small>
        </div>

        <div class="analytics-summary-card">
          <span>Recovery Rate</span>
          <strong>${data.recoveryRate.toFixed(1)}%</strong>
          <small>${data.accepted} accepted out of ${data.decidedCount} decided</small>
        </div>
      </section>

      <section class="panel analytics-panel">
        <div class="panel-heading">
          <div>
            <h2>Quotation Value by Currency</h2>
            <p>
              Values are grouped by currency. Different currencies
              are never added together.
            </p>
          </div>
        </div>

        ${currencyRows ? `
          <div class="table-wrap">
            <table class="quote-table analytics-table">
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Total Quoted</th>
                  <th>Outstanding</th>
                  <th>Accepted</th>
                  <th>Declined</th>
                </tr>
              </thead>
              <tbody>${currencyRows}</tbody>
            </table>
          </div>
        ` : `
          <div class="analytics-empty">
            No quotation values to analyse yet.
          </div>
        `}
      </section>

      <section class="analytics-two-column">
        <div class="panel analytics-panel">
          <div class="panel-heading">
            <div>
              <h2>Quotation Status Breakdown</h2>
              <p>How your quotations are currently distributed.</p>
            </div>
          </div>

          ${statusRows || `
            <div class="analytics-empty">No quotation statuses available yet.</div>
          `}
        </div>

        <div class="panel analytics-panel">
          <div class="panel-heading">
            <div>
              <h2>Activity Outcomes</h2>
              <p>${data.activityCount} customer interactions recorded.</p>
            </div>
          </div>

          ${outcomeRows || `
            <div class="analytics-empty">No activity outcomes recorded yet.</div>
          `}
        </div>
      </section>

      <section class="panel analytics-panel">
        <div class="panel-heading">
          <div>
            <h2>Monthly Quotation Activity</h2>
            <p>
              Quotations recorded by their Date Sent over the last six months.
              Accepted counts reflect their current status.
            </p>
          </div>
        </div>

        ${monthlyRows}
      </section>

      <p class="analytics-footnote">
        <strong>How these figures are calculated:</strong>
        Recovery Rate = Accepted quotations ÷ (Accepted + Declined quotations).
        Outstanding includes quotations not marked Accepted, Declined,
        Expired or Closed - No Response. Do Not Contact records remain
        in outstanding totals if their quotation is still open.
        Monthly figures are grouped by Date Sent, not the date a quotation
        was accepted. These figures update automatically from your
        Quote Register and Activity Log.
      </p>
    `;
  },

  // ==========================================
  // FOLLOW-UP PLANNER
  // ==========================================

  renderPlanner() {
    const main = document.getElementById("main-content");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayKey = this.localDateKey(today);

    const addDays = (date, days) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return this.localDateKey(result);
    };

    const sevenDaysLater = addDays(today, 7);

    const activeQuotes = this.state.quotes.filter(quote => {
      return !quote.doNotContact &&
        ![
          "Accepted", "Declined", "Expired", "Closed - No Response"
        ].includes(quote.status) &&
        Boolean(quote.nextFollowUpDate);
    });

    const groups = [
      {
        title: "Overdue",
        description: "Follow-ups that have passed their scheduled date.",
        className: "planner-overdue",
        quotes: activeQuotes.filter(q =>
          q.nextFollowUpDate < todayKey)
      },
      {
        title: "Due Today",
        description: "Customers who need attention today.",
        className: "planner-today",
        quotes: activeQuotes.filter(q =>
          q.nextFollowUpDate === todayKey)
      },
      {
        title: "Next 7 Days",
        description: "Follow-ups scheduled within the next seven days.",
        className: "planner-soon",
        quotes: activeQuotes.filter(q =>
          q.nextFollowUpDate > todayKey &&
          q.nextFollowUpDate <= sevenDaysLater)
      },
      {
        title: "Upcoming",
        description: "Follow-ups scheduled beyond the next seven days.",
        className: "planner-upcoming",
        quotes: activeQuotes.filter(q =>
          q.nextFollowUpDate > sevenDaysLater)
      }
    ];

    const total = groups.reduce(
      (sum, group) => sum + group.quotes.length, 0
    );

    const groupHTML = groups.map(group => {
      const sorted = [...group.quotes].sort((a, b) =>
        a.nextFollowUpDate.localeCompare(b.nextFollowUpDate)
      );

      return `
        <section class="panel planner-section ${group.className}">
          <div class="panel-heading">
            <div>
              <h2>${group.title}
                <span class="planner-count">${sorted.length}</span>
              </h2>
              <p>${group.description}</p>
            </div>
          </div>

          ${sorted.length ? `
            <div class="table-wrap">
              <table class="quote-table planner-table">
                <thead>
                  <tr>
                    <th>Quote ID</th>
                    <th>Customer</th>
                    <th>Quote Amount</th>
                    <th>Follow-up Date</th>
                    <th>Channel</th>
                    <th>Assigned To</th>
                    <th>Recommended Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${sorted.map(q => `
                    <tr>
                      <td><strong>${this.escape(q.id)}</strong></td>
                      <td>
                        <strong>${this.escape(q.customerName)}</strong>
                        <small>${this.escape(q.businessName || "")}</small>
                      </td>
                      <td>${this.formatMoney(q.amount, q.currency)}</td>
                      <td>${this.escape(q.nextFollowUpDate)}</td>
                      <td>${this.escape(q.channel || "Not specified")}</td>
                      <td>${this.escape(q.assignedTo || "Unassigned")}</td>
                      <td>${this.getRecommendedAction(q)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="planner-empty">
              <span>✓</span>
              <p>No quotations in this category.</p>
            </div>
          `}
        </section>
      `;
    }).join("");

    const unscheduled = this.state.quotes.filter(q =>
      !q.doNotContact &&
      ![
        "Accepted", "Declined", "Expired", "Closed - No Response"
      ].includes(q.status) &&
      !q.nextFollowUpDate
    ).length;

    main.innerHTML = `
      <section class="page-heading">
        <div>
          <p class="eyebrow">FOLLOW-UP MANAGEMENT</p>
          <h1>Follow-up Planner</h1>
          <p class="page-description">
            Prioritise customer follow-ups and keep quotations moving.
          </p>
        </div>
      </section>

      <section class="planner-summary">
        <div class="planner-summary-card">
          <span>Active Follow-ups</span><strong>${total}</strong>
        </div>
        <div class="planner-summary-card">
          <span>Overdue</span><strong>${groups[0].quotes.length}</strong>
        </div>
        <div class="planner-summary-card">
          <span>Due Today</span><strong>${groups[1].quotes.length}</strong>
        </div>
        <div class="planner-summary-card">
          <span>Needs a Date</span><strong>${unscheduled}</strong>
        </div>
      </section>

      ${groupHTML}

      <p class="planner-note">
        Follow-up priorities are calculated from the dates and statuses
        recorded in your Quote Register. Records without a scheduled
        follow-up date are not assigned an invented date.
      </p>
    `;
  },

  getRecommendedAction(quote) {
    const status = this.getFollowUpStatus(quote);

    if (status === "Overdue") {
      return "Contact customer and confirm decision";
    }

    if (status === "Due today") {
      return "Check progress and ask for an update";
    }

    if (quote.status === "Negotiating") {
      return "Follow up on outstanding terms";
    }

    if (quote.status === "Draft") {
      return "Finalise and send quotation";
    }

    return "Confirm receipt and ask about questions";
  },

  // ==========================================
  // SETTINGS, DATA IMPORT, EXPORT & BACKUP
  // ==========================================

  renderSettings() {
    const main = document.getElementById("main-content");
    if (!main) return;

    const settings = this.normalizeSettings(this.state.settings);
    const quoteCount = this.state.quotes.length;
    const activityCount = this.state.activities.length;

    main.innerHTML = `
      <section class="page-heading">
        <div>
          <p class="eyebrow">APPLICATION PREFERENCES</p>
          <h1>Settings</h1>
          <p class="page-description">
            Manage preferences, import and export records, and protect your data.
          </p>
        </div>
      </section>

      <section class="panel settings-panel">
        <div class="panel-heading">
          <div>
            <h2>1. General Settings</h2>
            <p>Set your business details and follow-up preferences.</p>
          </div>
        </div>

        <form id="settings-form" novalidate>
          <div class="quote-form-grid">
            <label>
              Business Name
              <input name="businessName"
                value="${this.escape(settings.businessName)}"
                placeholder="Enter business name">
              <small>Used to sign the messages you generate.</small>
            </label>

            <label>
              Default Currency
              <select name="defaultCurrency">
                ${this.currencies.map(currency => `
                  <option value="${currency}"
                    ${settings.defaultCurrency === currency ? "selected" : ""}>
                    ${currency}
                  </option>
                `).join("")}
              </select>
              <small>Pre-selected when you add a new quotation.</small>
            </label>

            <label class="wide-field">
              Default Follow-up Intervals (Days)
              <input name="followUpDays"
                value="${this.escape(settings.followUpDays.join(", "))}"
                placeholder="1, 3, 5, 7">
              <small>Whole numbers from 1 to 365, separated by commas.
                They appear as optional date suggestions in the quotation form.
                No follow-up date is ever set automatically.</small>
            </label>
          </div>

          <div class="form-actions">
            <button type="submit" class="primary-button">
              Save Settings
            </button>
          </div>
        </form>
      </section>

      <section class="panel settings-panel">
        <div class="panel-heading">
          <div>
            <h2>2. Data Export</h2>
            <p>Download your records for reporting and safekeeping
              (${quoteCount} quotation${quoteCount === 1 ? "" : "s"},
              ${activityCount} activit${activityCount === 1 ? "y" : "ies"}).</p>
          </div>
        </div>

        <div class="settings-action-list">
          <div class="settings-action">
            <div>
              <strong>Export Quote Register as CSV</strong>
              <p>Download all quotation records.</p>
            </div>
            <button type="button" class="secondary-button"
              id="export-quotes-csv">Export Quotes</button>
          </div>

          <div class="settings-action">
            <div>
              <strong>Export Activity Log as CSV</strong>
              <p>Download all customer interactions.</p>
            </div>
            <button type="button" class="secondary-button"
              id="export-activities-csv">Export Activities</button>
          </div>

          <div class="settings-action">
            <div>
              <strong>Export All Data as JSON</strong>
              <p>Download quotations, activities and settings together.</p>
            </div>
            <button type="button" class="primary-button"
              id="download-backup">Download JSON Backup</button>
          </div>
        </div>

        <p class="settings-footnote">
          If there are no records yet, the CSV exports contain only the
          column headings, which you can use as an import template.
        </p>
      </section>

      <section class="panel settings-panel">
        <div class="panel-heading">
          <div>
            <h2>3. Data Import</h2>
            <p>Import CSV records. Every file is validated before anything is saved.</p>
          </div>
        </div>

        <div class="settings-action-list">
          <div class="settings-action">
            <div>
              <strong>Import Quote Register CSV</strong>
              <p>Use a CSV exported from this application. Dates must be
                YYYY-MM-DD. Records with an existing Quote ID update that quotation.</p>
            </div>
            <button type="button" class="secondary-button"
              id="import-quotes-button">Choose Quote CSV</button>
            <input type="file" id="import-quotes-file"
              accept=".csv,text/csv" hidden>
          </div>

          <div class="settings-action">
            <div>
              <strong>Import Activity Log CSV</strong>
              <p>Each activity must link to a Quote ID that already exists.
                Import quotations first.</p>
            </div>
            <button type="button" class="secondary-button"
              id="import-activities-button">Choose Activity CSV</button>
            <input type="file" id="import-activities-file"
              accept=".csv,text/csv" hidden>
          </div>
        </div>
      </section>

      <section class="panel settings-panel">
        <div class="panel-heading">
          <div>
            <h2>4. Backup and Restore</h2>
            <p>Protect your records and restore a previous application backup.</p>
          </div>
        </div>

        <div class="settings-action-list">
          <div class="settings-action">
            <div>
              <strong>Download Complete Backup</strong>
              <p>Save all quotations, activities and settings in one JSON file.</p>
            </div>
            <button type="button" class="primary-button"
              id="download-backup-secondary">Download Backup</button>
          </div>

          <div class="settings-action">
            <div>
              <strong>Restore from Backup</strong>
              <p>The backup is checked first. You will be asked to confirm
                before your current data is replaced.</p>
            </div>
            <button type="button" class="secondary-button"
              id="restore-backup-button">Choose Backup</button>
            <input type="file" id="restore-backup-file"
              accept=".json,application/json" hidden>
          </div>
        </div>
      </section>

      <p class="settings-footnote">
        Your records are stored in this browser only. Download backups regularly
        and keep a copy somewhere safe. Clearing browser data will delete
        records that have not been backed up.
      </p>
    `;
  },

  parseIntervals(text) {
    const tokens = String(text || "")
      .split(",")
      .map(token => token.trim())
      .filter(Boolean);

    if (!tokens.length) {
      return { error: "Enter at least one follow-up interval, such as 1, 3, 5, 7." };
    }

    const invalid = tokens.find(token => {
      const number = Number(token);
      return !/^\d+$/.test(token) || number < 1 || number > 365;
    });

    if (invalid !== undefined) {
      return {
        error: `"${invalid}" is not valid. Use whole numbers from 1 to 365, separated by commas.`
      };
    }

    return {
      values: [...new Set(tokens.map(Number))].sort((a, b) => a - b)
    };
  },

  saveSettings(formData) {
    const data = Object.fromEntries(formData.entries());
    const intervals = this.parseIntervals(data.followUpDays);

    if (intervals.error) {
      alert(intervals.error);
      return;
    }

    const previous = this.state.settings;

    this.state.settings = this.normalizeSettings({
      ...previous,
      businessName: String(data.businessName || "").trim(),
      defaultCurrency: data.defaultCurrency,
      followUpDays: intervals.values
    });

    if (!this.saveData()) {
      this.state.settings = previous;
      return;
    }

    alert("Settings saved successfully.");
    this.renderSettings();
  },

  // ---------- Export ----------

  csvCell(value) {
    let text = value === null || value === undefined ? "" : String(value);

    // Reduce the risk of spreadsheet formula execution.
    // The import routine removes this leading apostrophe again.
    if (/^[=+\-@\t\r]/.test(text)) {
      text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
  },

  downloadCSV(filename, headers, rows) {
    const csv = [
      headers.map(value => this.csvCell(value)).join(","),
      ...rows.map(row => row.map(value => this.csvCell(value)).join(","))
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    this.downloadFile(filename, blob);
  },

  downloadFile(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  exportQuotesCSV() {
    const headers = [
      "Quote ID", "Customer Name", "Business Name", "Customer Email",
      "Customer Phone", "Quote Description", "Quote Amount", "Currency",
      "Date Sent", "Expiry Date", "Status", "Last Contact Date",
      "Next Follow-up Date", "Follow-up Channel", "Do Not Contact",
      "Assigned To", "Internal Notes", "Created At"
    ];

    const rows = this.state.quotes.map(quote => [
      quote.id, quote.customerName, quote.businessName, quote.email,
      quote.phone, quote.description, quote.amount, quote.currency,
      quote.dateSent, quote.expiryDate, quote.status, quote.lastContactDate,
      quote.nextFollowUpDate, quote.channel,
      quote.doNotContact ? "Yes" : "No",
      quote.assignedTo, quote.notes, quote.createdAt
    ]);

    this.downloadCSV(
      `open-quote-recovery-quotes-${this.localDateKey()}.csv`,
      headers,
      rows
    );
  },

  exportActivitiesCSV() {
    const headers = [
      "Activity ID", "Date", "Quote ID", "Customer Name",
      "Activity Type", "Contact Channel", "Outcome", "Next Action",
      "Next Follow-up Date", "Assigned To", "Notes"
    ];

    const rows = this.state.activities.map(activity => [
      activity.id, activity.date, activity.quoteId, activity.customerName,
      activity.activityType, activity.channel, activity.outcome,
      activity.nextAction, activity.nextFollowUpDate,
      activity.assignedTo, activity.notes
    ]);

    this.downloadCSV(
      `open-quote-recovery-activities-${this.localDateKey()}.csv`,
      headers,
      rows
    );
  },

  downloadBackup() {
    const backup = {
      application: this.name,
      version: this.version,
      exportedAt: new Date().toISOString(),
      data: this.state
    };

    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: "application/json" }
    );

    this.downloadFile(
      `open-quote-recovery-backup-${this.localDateKey()}.json`,
      blob
    );
  },

  // ---------- Import ----------

  // CSV parser supports quoted fields, commas and line breaks inside quotes.
  parseCSV(text) {
    const rows = [];
    let row = [];
    let value = "";
    let insideQuotes = false;

    text = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && insideQuotes && next === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === "," && !insideQuotes) {
        row.push(value);
        value = "";
      } else if ((char === "\n" || char === "\r") && !insideQuotes) {
        if (char === "\r" && next === "\n") i++;
        row.push(value);

        if (row.some(cell => cell.trim() !== "")) {
          rows.push(row);
        }

        row = [];
        value = "";
      } else {
        value += char;
      }
    }

    if (insideQuotes) {
      throw new Error("The CSV has an unclosed quotation mark.");
    }

    row.push(value);

    if (row.some(cell => cell.trim() !== "")) {
      rows.push(row);
    }

    if (!rows.length) {
      throw new Error("The CSV file is empty.");
    }

    const headers = rows.shift().map(header =>
      header.trim().toLowerCase().replace(/^\uFEFF/, "")
    );

    if (headers.some(header => !header)) {
      throw new Error("The CSV contains an empty column heading.");
    }

    if (new Set(headers).size !== headers.length) {
      throw new Error("The CSV contains duplicate column headings.");
    }

    if (!rows.length) {
      throw new Error("The CSV contains column headings but no records.");
    }

    return rows.map((cells, index) => {
      if (cells.length !== headers.length) {
        throw new Error(`CSV row ${index + 2} has an incorrect number of columns.`);
      }

      const record = {};
      headers.forEach((header, column) => {
        // Remove the apostrophe added on export to neutralise formulas.
        record[header] = cells[column].trim().replace(/^'(?=[=+\-@])/, "");
      });

      return record;
    });
  },

  csvValue(record, ...names) {
    for (const name of names) {
      const key = name.toLowerCase();
      if (record[key] !== undefined) return record[key];
    }
    return "";
  },

  async readImportFile(file, expectedExtension) {
    if (!file.name.toLowerCase().endsWith(expectedExtension)) {
      throw new Error(`Please choose a ${expectedExtension} file.`);
    }

    if (file.size > this.maxImportBytes) {
      throw new Error("The file is larger than 5 MB.");
    }

    return file.text();
  },

  async importQuotesCSV(file) {
    try {
      const records = this.parseCSV(await this.readImportFile(file, ".csv"));

      const errors = [];
      const imported = [];

      records.forEach((record, index) => {
        const rowNumber = index + 2;
        const fail = message => errors.push(`Row ${rowNumber}: ${message}`);

        const quote = {
          id: this.csvValue(record, "quote id", "id"),
          customerName: this.csvValue(record, "customer name", "customername"),
          businessName: this.csvValue(record, "business name", "businessname"),
          email: this.csvValue(record, "customer email", "email"),
          phone: this.csvValue(record, "customer phone", "phone"),
          description: this.csvValue(record, "quote description", "description"),
          amount: this.csvValue(record, "quote amount", "amount"),
          currency: this.csvValue(record, "currency") ||
            this.state.settings.defaultCurrency,
          dateSent: this.csvValue(record, "date sent", "datesent"),
          expiryDate: this.csvValue(record, "expiry date", "expirydate", "quote expiry date"),
          status: this.csvValue(record, "status", "quote status") || "Sent",
          lastContactDate: this.csvValue(record, "last contact date", "lastcontactdate"),
          nextFollowUpDate: this.csvValue(record, "next follow-up date", "nextfollowupdate"),
          channel: this.csvValue(record, "follow-up channel", "channel"),
          doNotContact: ["yes", "true", "1"].includes(
            this.csvValue(record, "do not contact", "donotcontact").toLowerCase()
          ),
          assignedTo: this.csvValue(record, "assigned to", "assignedto"),
          notes: this.csvValue(record, "internal notes", "notes"),
          createdAt: this.csvValue(record, "created at", "createdat") ||
            new Date().toISOString()
        };

        if (!quote.id) fail("Quote ID is required.");
        if (!quote.customerName) fail("Customer Name is required.");

        if (!this.currencies.includes(quote.currency)) {
          fail(`Unsupported currency "${quote.currency}".`);
        }

        if (!this.statuses.includes(quote.status)) {
          fail(`Invalid quotation status "${quote.status}".`);
        }

        if (quote.channel && !this.channels.includes(quote.channel)) {
          fail(`Invalid follow-up channel "${quote.channel}".`);
        }

        const amount = Number(quote.amount);

        if (quote.amount === "" || !Number.isFinite(amount) || amount < 0) {
          fail("Quote Amount must be a number of zero or more.");
        } else {
          quote.amount = amount;
        }

        [
          ["Date Sent", quote.dateSent],
          ["Expiry Date", quote.expiryDate],
          ["Last Contact Date", quote.lastContactDate],
          ["Next Follow-up Date", quote.nextFollowUpDate]
        ].forEach(([label, date]) => {
          if (!this.isValidDateString(date)) {
            fail(`${label} "${date}" must use the format YYYY-MM-DD.`);
          }
        });

        imported.push(quote);
      });

      const seen = new Set();

      imported.forEach((quote, index) => {
        if (!quote.id) return;

        if (seen.has(quote.id)) {
          errors.push(`Row ${index + 2}: Duplicate Quote ID "${quote.id}" in the file.`);
        }

        "use strict";
/*
  ORK Stage B: frontend foundation (additive).
  Load AFTER app.js (or paste at the very end of app.js).
  Adds: grouped 13-area navigation, honest "planned" module pages,
  and a rebuilt Overview dashboard calculated only from stored records.
  Does not touch the localStorage schema or any existing module.
*/
(function () {
  if (typeof ORK === "undefined") {
    console.error("ORK foundation: app.js must load first.");
    return;
  }

  const CLOSED = ["Accepted", "Declined", "Expired", "Closed - No Response"];

  const NAV = [
    { group: "Workspace", items: [
      { view: "dashboard", icon: "◈", label: "Overview" }] },
    { group: "Sell", items: [
      { view: "crm", icon: "☺", label: "CRM", planned: true },
      { view: "pipeline", icon: "⇉", label: "Sales Pipeline", planned: true },
      { view: "quotes", icon: "▤", label: "Quotations" },
      { view: "proposals", icon: "❏", label: "Proposals", planned: true }] },
    { group: "Get paid", items: [
      { view: "invoices", icon: "▥", label: "Invoices", planned: true },
      { view: "payments", icon: "⇄", label: "Payments", planned: true }] },
    { group: "Engage", items: [
      { view: "planner", icon: "◷", label: "Follow-up Centre" },
      { view: "activities", icon: "☰", label: "Activity Log", sub: true },
      { view: "messages", icon: "✉", label: "Communication Centre" }] },
    { group: "Insight and admin", items: [
      { view: "analytics", icon: "▲", label: "Reports" },
      { view: "team", icon: "⚑", label: "Team and Tasks", planned: true },
      { view: "integrations", icon: "⌁", label: "Integrations", planned: true },
      { view: "settings", icon: "⚙", label: "Settings" }] }
  ];

  const TITLES = {
    quotes: "Quotations", planner: "Follow-up Centre",
    activities: "Activity Log", messages: "Communication Centre",
    analytics: "Reports", settings: "Settings"
  };

  const PLANNED = {
    crm: { title: "CRM", stage: "Stage C",
      summary: "Customer profiles that tie together every quotation, invoice, payment, task and conversation.",
      local: "Customer records, notes, tags and linked history can run in the browser first.",
      backend: "Sharing customers between team members needs authentication and a database." },
    pipeline: { title: "Sales Pipeline", stage: "Stage C",
      summary: "Kanban and list views from New Lead to Won or Lost, with weighted pipeline value.",
      local: "Stages, owners, values, lost reasons and links to quotations work in the browser.",
      backend: "Per-user ownership rules need a backend." },
    proposals: { title: "Proposals", stage: "Stage C",
      summary: "Detailed offers with deliverables, terms and validity, convertible to quotations or invoices.",
      local: "Drafting, statuses and printable PDF proposals work in the browser.",
      backend: "'Viewed' and 'signed' events need a real tracking or e-signature service. ORK will not claim them without one." },
    invoices: { title: "Invoices", stage: "Stage C",
      summary: "Unique invoice numbers, line items, tax, discounts, partial payments and overdue tracking.",
      local: "Invoice creation, exact decimal totals, balances and PDF output work in the browser.",
      backend: "Invoice capture (OCR) and secure document storage need an OCR service and file storage." },
    payments: { title: "Payments", stage: "Stage C",
      summary: "Manual payment records, partial payments, refunds, reversals and an audit trail.",
      local: "Manual recording and reconciliation against invoices work in the browser.",
      backend: "Automatic bank feeds need a licensed financial-data provider and a secure backend. No bank connection is simulated." },
    team: { title: "Team and Tasks", stage: "Stage D",
      summary: "Task lists, assignments and team profiles linked to customers, quotations and invoices.",
      local: "Tasks and assignee labels can work in the browser.",
      backend: "Roles and permissions are only real once enforced by a backend. ORK will not claim multi-user support before then." },
    integrations: { title: "Integrations", stage: "Stage D",
      summary: "Banking, payment gateways, email, calendar, WhatsApp Business, accounting, storage and AI.",
      local: "Only the existing Google Sheets sync is live today (configured in app.js).",
      backend: "Every other integration needs provider accounts and server-side secrets. None is connected." }
  };

  // ------------------------------------------------------------
  // Navigation
  // ------------------------------------------------------------
  function buildNav() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;

    sidebar.querySelectorAll(".nav-item[data-view]").forEach(el => el.remove());

    let nav = sidebar.querySelector(".sidebar-nav");
    if (!nav) {
      nav = document.createElement("nav");
      nav.className = "sidebar-nav";
      sidebar.insertBefore(nav, sidebar.querySelector(".sidebar-bottom"));
    }

    nav.setAttribute("aria-label", "Primary");
    nav.innerHTML = NAV.map(group => `
      <div class="nav-group">
        <p class="nav-group-label">${group.group}</p>
        ${group.items.map(item => `
          <button type="button" class="nav-item${item.sub ? " nav-sub" : ""}"
            data-view="${item.view}">
            <span aria-hidden="true">${item.icon}</span>
            <em>${item.label}</em>
            ${item.planned ? '<b class="nav-tag">Planned</b>' : ""}
          </button>`).join("")}
      </div>`).join("");
  }

  function markActive(view) {
    document.querySelectorAll(".nav-item[data-view]").forEach(item => {
      const active = item.dataset.view === view;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  }

  const coreInit = ORK.init;
  ORK.init = function () {
    buildNav();
    coreInit.call(this);
  };

  const coreShowView = ORK.showView;
  ORK.showView = function (view) {
    const planned = PLANNED[view];

    if (view === "dashboard" || planned) {
      const main = document.getElementById("main-content");
      const title = document.getElementById("page-title");
      if (!main || !title) return;

      this.currentView = view;
      title.textContent = view === "dashboard" ? "Overview" : planned.title;
      markActive(view);

      if (view === "dashboard") this.renderDashboard();
      else this.renderPlanned(view);

      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    coreShowView.call(this, view);

    const title = document.getElementById("page-title");
    if (title && TITLES[view] && this.currentView === view) {
      title.textContent = TITLES[view];
    }
    markActive(view);
  };

  // ------------------------------------------------------------
  // Planned module pages (honest: nothing here is functional)
  // ------------------------------------------------------------
  ORK.renderPlanned = function (view) {
    const p = PLANNED[view];
    const e = v => this.escape(v);

    document.getElementById("main-content").innerHTML = `
      <section class="page-heading">
        <div>
          <p class="eyebrow">OPEN QUOTE RECOVERY KIT</p>
          <h1>${e(p.title)}</h1>
          <p class="page-description">${e(p.summary)}</p>
        </div>
        <span class="pill pill-planned">Planned · ${e(p.stage)}</span>
      </section>

      <section class="panel planned-panel">
        <div class="notice notice-info">
          This module has not been built yet. Nothing on this page reads or
          changes your records.
        </div>
        <div class="planned-columns">
          <div>
            <h2>Can be built in the browser</h2>
            <p>${e(p.local)}</p>
          </div>
          <div>
            <h2>Depends on backend infrastructure</h2>
            <p>${e(p.backend)}</p>
          </div>
        </div>
      </section>`;
  };

  // ------------------------------------------------------------
  // Overview dashboard (all figures calculated from stored records)
  // ------------------------------------------------------------
  ORK.dashRange = { from: "", to: "" };

  const inRange = (date, range) => {
    if (!range.from && !range.to) return true;
    if (!date) return false;
    return (!range.from || date >= range.from) && (!range.to || date <= range.to);
  };

  const totalsByCurrency = (quotes, fallback) => {
    const totals = {};
    quotes.forEach(q => {
      const c = String(q.currency || fallback).toUpperCase();
      totals[c] = Math.round(((totals[c] || 0) + (Number(q.amount) || 0)) * 100) / 100;
    });
    return totals;
  };

  const formatGroups = (totals, fallback) => {
    const rows = Object.entries(totals).sort(([a], [b]) => a.localeCompare(b));
    return rows.length
      ? rows.map(([c, a]) => ORK.formatMoney(a, c)).join(" · ")
      : ORK.formatMoney(0, fallback);
  };

  async function getRates(base) {
    const key = `ork_fx_rates_${base}`;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(key) || "null"); } catch { /* ignore */ }

    if (cached && cached.rates && cached.nextUpdateUnix * 1000 > Date.now()) return cached;

    try {
      const response = await fetch(`https://open.er-api.com/v6/latest/${base}`);
      if (!response.ok) throw new Error("Exchange rate request failed.");
      const data = await response.json();
      if (data.result !== "success" || !data.rates) throw new Error("No rates returned.");

      const fresh = {
        rates: data.rates,
        lastUpdated: data.time_last_update_utc,
        nextUpdateUnix: data.time_next_update_unix
      };
      localStorage.setItem(key, JSON.stringify(fresh));
      return fresh;
    } catch (error) {
      console.warn("Using saved exchange rates:", error);
      return cached && cached.rates ? cached : null;
    }
  }

  // Converted total is shown only as a labelled estimate with its rate date.
  async function showConverted(totals, base) {
    const currencies = Object.keys(totals);
    if (currencies.every(c => c === base)) return;

    const rates = await getRates(base);
    const el = document.getElementById("kpi-fx");
    if (!el) return;

    if (!rates) {
      el.textContent = "Mixed currencies. Exchange rates unavailable offline.";
      return;
    }

    let sum = 0;
    for (const [currency, amount] of Object.entries(totals)) {
      const rate = Number(rates.rates[currency]);
      if (currency !== base && (!rate || !Number.isFinite(rate))) {
        el.textContent = `No exchange rate available for ${currency}.`;
        return;
      }
      sum += currency === base ? amount : amount / rate;
    }

    el.textContent =
      `Estimate: ${ORK.formatMoney(sum, base)} in ${base} · rates ${rates.lastUpdated || "saved"}`;
  }

  function monthlyChart(rows) {
    const W = 480, H = 190, padX = 24, top = 22, bottom = 28;
    const max = Math.max(1, ...rows.map(r => r.sent));
    const slot = (W - padX * 2) / rows.length;
    const plotH = H - top - bottom;

    const bars = rows.map((r, i) => {
      const x = padX + i * slot;
      const h1 = (r.sent / max) * plotH;
      const h2 = (r.accepted / max) * plotH;
      return `
        <rect class="bar-sent" x="${x + slot * 0.16}" y="${H - bottom - h1}"
          width="${slot * 0.3}" height="${h1}" rx="3"></rect>
        <rect class="bar-acc" x="${x + slot * 0.52}" y="${H - bottom - h2}"
          width="${slot * 0.3}" height="${h2}" rx="3"></rect>
        ${r.sent ? `<text class="chart-num" x="${x + slot * 0.31}"
          y="${H - bottom - h1 - 5}" text-anchor="middle">${r.sent}</text>` : ""}
        <text class="chart-label" x="${x + slot / 2}" y="${H - 9}"
          text-anchor="middle">${ORK.escape(r.label)}</text>`;
    }).join("");

    return `<svg viewBox="0 0 ${W} ${H}" role="img"
      aria-label="Quotations sent and accepted per month, last six months">
      <line class="chart-axis" x1="${padX}" x2="${W - padX}"
        y1="${H - bottom}" y2="${H - bottom}"></line>${bars}</svg>`;
  }

  ORK.renderDashboard = function () {
    const main = document.getElementById("main-content");
    if (!main) return;

    const s = this.state;
    const e = v => this.escape(v);
    const range = this.dashRange;
    const base = (s.settings.defaultCurrency || "USD").toUpperCase();

    // Quotation metrics respect the date filter (by Date Sent).
    const scoped = s.quotes.filter(q => inRange(q.dateSent, range));
    const open = scoped.filter(q => !CLOSED.includes(q.status));
    const accepted = scoped.filter(q => q.status === "Accepted");
    const declined = scoped.filter(q => q.status === "Declined");
    const decided = accepted.length + declined.length;
    const rate = decided ? (accepted.length / decided) * 100 : null;
    const sent = scoped.filter(q => q.status !== "Draft").length;

    const openTotals = totalsByCurrency(open, base);

    // Follow-up items always show live status.
    const live = s.quotes;
    const status = q => this.getFollowUpStatus(q);
    const overdue = live.filter(q => status(q) === "Overdue");
    const dueToday = live.filter(q => status(q) === "Due today");
    const byDate = (a, b) =>
      String(a.nextFollowUpDate).localeCompare(String(b.nextFollowUpDate));
    const priorities = [...overdue, ...dueToday].sort(byDate).slice(0, 5);
    const upcoming = live.filter(q => status(q) === "Upcoming").sort(byDate).slice(0, 5);
    const needsDate = live.filter(q =>
      !q.doNotContact && !CLOSED.includes(q.status) && !q.nextFollowUpDate).length;
    const recent = [...s.activities]
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 5);

    const kpi = (label, value, note, tone = "", noteId = "") => `
      <div class="kpi ${tone}">
        <span class="kpi-label">${label}</span>
        <strong class="kpi-value">${value}</strong>
        <small class="kpi-note"${noteId ? ` id="${noteId}"` : ""}>${note}</small>
      </div>`;

    const feedEmpty = text => `<p class="feed-empty">${text}</p>`;
    const quoteItem = (q, meta) => `
      <button type="button" class="feed-item" data-open-quote="${e(q.id)}">
        <strong>${e(q.customerName)}</strong>
        <span>${e(q.description)}</span>
        <small>${meta}</small>
      </button>`;
    const followMeta = q => `${e(status(q))} · ${this.formatDate(q.nextFollowUpDate)}`;

    // Chart data
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const inMonth = scoped.filter(q => String(q.dateSent || "").startsWith(key));
      months.push({
        label: d.toLocaleDateString(undefined, { month: "short" }),
        sent: inMonth.length,
        accepted: inMonth.filter(q => q.status === "Accepted").length
      });
    }

    const statusRows = this.statuses
      .map(name => ({ name, count: scoped.filter(q => q.status === name).length }))
      .filter(row => row.count > 0);
    const maxStatus = Math.max(1, ...statusRows.map(r => r.count));

    const total = scoped.length;
    const otherClosed = total - open.length - accepted.length - declined.length;
    const seg = (cls, label, n) => n ? `
      <div class="seg ${cls}" style="flex:${n}" title="${label}: ${n}"></div>` : "";
    const legend = (cls, label, n) => `
      <li><i class="swatch ${cls}"></i>${label}<strong>${n}</strong></li>`;

    const hasRange = Boolean(range.from || range.to);

    main.innerHTML = `
      <section class="page-heading">
        <div>
          <p class="eyebrow">OPEN QUOTE RECOVERY KIT</p>
          <h1>Business overview</h1>
          <p class="page-description">
            Quotation performance and follow-up health, calculated from the
            records stored in this browser.
          </p>
        </div>
        <button class="primary-button" id="add-quote-button">+ Add New Quote</button>
      </section>

      <section class="panel filter-bar">
        <label>From <input type="date" id="dash-from" value="${e(range.from)}"></label>
        <label>To <input type="date" id="dash-to" value="${e(range.to)}"></label>
        <button type="button" class="secondary-button" id="dash-clear-range"
          ${hasRange ? "" : "disabled"}>Clear dates</button>
        <p class="filter-hint">
          Filters quotation figures and charts by Date Sent. Follow-up items
          always show their live status.
        </p>
      </section>

      <section class="kpi-group">
        <h2>Quotations</h2>
        <div class="kpi-grid">
          ${kpi("Outstanding quotation value", formatGroups(openTotals, base),
            `${open.length} open quotation${open.length === 1 ? "" : "s"}. Currencies are never added together.`,
            "", "kpi-fx")}
          ${kpi("Accepted value", formatGroups(totalsByCurrency(accepted, base), base),
            `${accepted.length} accepted quotation${accepted.length === 1 ? "" : "s"}. Quoted, not yet invoiced or collected.`)}
          ${kpi("Quotation conversion", rate === null ? "—" : rate.toFixed(1) + "%",
            decided ? `${accepted.length} accepted of ${decided} decided` : "No accepted or declined quotations yet")}
          ${kpi("Quotations sent", String(sent), `${total} recorded in this period, including drafts`)}
        </div>
      </section>

      <section class="kpi-group">
        <h2>Follow-ups</h2>
        <div class="kpi-grid kpi-grid-3">
          ${kpi("Due today or overdue", String(overdue.length + dueToday.length),
            "Open quotations needing contact", overdue.length + dueToday.length ? "kpi-warn" : "")}
          ${kpi("Overdue", String(overdue.length),
            "Scheduled date has passed", overdue.length ? "kpi-danger" : "")}
          ${kpi("Needs a date", String(needsDate),
            "Open quotations with no follow-up scheduled")}
        </div>
      </section>

      <div class="notice notice-info">
        Invoice, payment, customer and pipeline metrics will appear here when
        those modules are built. They are not shown now because there are no
        records to calculate them from.
      </div>

      ${total ? `
      <section class="chart-grid">
        <div class="panel">
          <div class="panel-heading"><div>
            <h2>Quotations by month</h2>
            <p>Sent versus accepted, by Date Sent, last six months</p>
          </div></div>
          ${monthlyChart(months)}
          <ul class="legend legend-row">
            <li><i class="swatch seg-open"></i>Sent</li>
            <li><i class="swatch seg-acc"></i>Accepted</li>
          </ul>
        </div>

        <div class="panel">
          <div class="panel-heading"><div>
            <h2>Status mix</h2>
            <p>Current status of quotations in this period</p>
          </div></div>
          <div class="seg-bar">
            ${seg("seg-acc", "Accepted", accepted.length)}
            ${seg("seg-dec", "Declined", declined.length)}
            ${seg("seg-open", "Open", open.length)}
            ${seg("seg-other", "Expired or closed", otherClosed)}
          </div>
          <ul class="legend">
            ${legend("seg-open", "Open", open.length)}
            ${legend("seg-acc", "Accepted", accepted.length)}
            ${legend("seg-dec", "Declined", declined.length)}
            ${legend("seg-other", "Expired or closed", otherClosed)}
          </ul>
          <div class="mini-bars">
            ${statusRows.map(r => `
              <div class="analytics-bar-item">
                <div class="analytics-bar-heading">
                  <span>${e(r.name)}</span><strong>${r.count}</strong>
                </div>
                <div class="analytics-track"><div class="analytics-bar"
                  style="width:${(r.count / maxStatus) * 100}%"></div></div>
              </div>`).join("")}
          </div>
        </div>
      </section>` : `
      <section class="panel">
        <div class="empty-state">
          <div class="empty-icon">▤</div>
          <strong>${hasRange ? "No quotations in this date range" : "No quotations yet"}</strong>
          <p>${hasRange ? "Clear or change the dates to see more." :
            "Add your first quotation and your charts will appear here."}</p>
        </div>
      </section>`}

      <section class="dash-lists">
        <div class="panel">
          <div class="panel-heading"><div>
            <h2>Follow-up priorities</h2><p>Overdue and due today</p>
          </div></div>
          ${priorities.length ? priorities.map(q => quoteItem(q, followMeta(q))).join("")
            : feedEmpty("Nothing due right now.")}
        </div>
        <div class="panel">
          <div class="panel-heading"><div>
            <h2>Upcoming follow-ups</h2><p>Next scheduled</p>
          </div></div>
          ${upcoming.length ? upcoming.map(q => quoteItem(q, followMeta(q))).join("")
            : feedEmpty("No upcoming follow-ups scheduled.")}
        </div>
        <div class="panel">
          <div class="panel-heading"><div>
            <h2>Recent activity</h2><p>Latest logged interactions</p>
          </div></div>
          ${recent.length ? recent.map(a => `
            <div class="feed-item">
              <strong>${e(a.customerName || "Customer")}</strong>
              <span>${e(a.activityType || "Activity")} · ${e(a.channel || "")}</span>
              <small>${e(a.outcome || "")} · ${this.formatDate(a.date)}</small>
            </div>`).join("") : feedEmpty("No activity recorded yet.")}
        </div>
      </section>`;

    showConverted(openTotals, base);
  };

  // ------------------------------------------------------------
  // Events for the new dashboard
  // ------------------------------------------------------------
  document.addEventListener("click", event => {
    const open = event.target.closest("[data-open-quote]");
    if (open) {
      ORK.showView("quotes");
      ORK.openQuoteForm(open.dataset.openQuote);
      return;
    }

    if (event.target.closest("#dash-clear-range")) {
      ORK.dashRange = { from: "", to: "" };
      ORK.renderDashboard();
    }
  });

  document.addEventListener("change", event => {
    if (event.target.id !== "dash-from" && event.target.id !== "dash-to") return;

    const from = document.getElementById("dash-from").value;
    const to = document.getElementById("dash-to").value;

    if (from && to && from > to) {
      alert("The start date must be on or before the end date.");
      return;
    }

    ORK.dashRange = { from, to };
    ORK.renderDashboard();
  });
})();
        seen.add(quote.id);
      });

      if (errors.length) {
        throw new Error(
          errors.slice(0, 8).join("\n") +
          (errors.length > 8 ? `\n...and ${errors.length - 8} more problems.` : "") +
          "\n\nNo records were imported."
        );
      }

      const existingIds = new Set(this.state.quotes.map(quote => quote.id));
      const replacements = imported.filter(quote => existingIds.has(quote.id)).length;

      const message =
        `Validation successful.\n\n` +
        `Records found: ${imported.length}\n` +
        `New records: ${imported.length - replacements}\n` +
        `Existing records to update: ${replacements}\n\n` +
        `Continue with the import?`;

      if (!confirm(message)) return;

      const merged = new Map(this.state.quotes.map(quote => [quote.id, quote]));

      imported.forEach(quote => {
        merged.set(quote.id, { ...merged.get(quote.id), ...quote });
      });

      const previous = this.state.quotes;
      this.state.quotes = Array.from(merged.values());

      if (!this.saveData()) {
        this.state.quotes = previous;
        return;
      }

      alert(`${imported.length} quotation records imported successfully.`);
      this.showView("quotes");
    } catch (error) {
      console.error("Quote CSV import failed:", error);
      alert("Quote CSV import failed:\n" + error.message);
    }
  },

  async importActivitiesCSV(file) {
    try {
      const records = this.parseCSV(await this.readImportFile(file, ".csv"));

      const quotesById = new Map(
        this.state.quotes.map(quote => [quote.id, quote])
      );

      const errors = [];
      const imported = [];

      records.forEach((record, index) => {
        const rowNumber = index + 2;
        const fail = message => errors.push(`Row ${rowNumber}: ${message}`);

        const activity = {
          id: this.csvValue(record, "activity id", "id"),
          date: this.csvValue(record, "date"),
          quoteId: this.csvValue(record, "quote id", "quoteid"),
          customerName: this.csvValue(record, "customer name", "customername"),
          activityType: this.csvValue(record, "activity type", "activitytype"),
          channel: this.csvValue(record, "contact channel", "channel"),
          outcome: this.csvValue(record, "outcome"),
          nextAction: this.csvValue(record, "next action", "nextaction"),
          nextFollowUpDate: this.csvValue(record, "next follow-up date", "nextfollowupdate"),
          assignedTo: this.csvValue(record, "assigned to", "assignedto"),
          notes: this.csvValue(record, "notes"),
          createdAt: new Date().toISOString()
        };

        if (!activity.id) fail("Activity ID is required.");
        if (!activity.date) fail("Date is required.");
        if (!activity.quoteId) fail("Quote ID is required.");

        if (activity.quoteId) {
          const quote = quotesById.get(activity.quoteId);

          if (!quote) {
            fail(`Quote ID "${activity.quoteId}" does not exist in the Quote Register. Import the quotations first.`);
          } else {
            activity.customerName = quote.customerName || activity.customerName;
          }
        }

        if (!this.activityTypes.includes(activity.activityType)) {
          fail(`Invalid activity type "${activity.activityType}".`);
        }

        if (!this.channels.includes(activity.channel)) {
          fail(`Invalid contact channel "${activity.channel}".`);
        }

        if (!this.activityOutcomes.includes(activity.outcome)) {
          fail(`Invalid activity outcome "${activity.outcome}".`);
        }

        [
          ["Date", activity.date],
          ["Next Follow-up Date", activity.nextFollowUpDate]
        ].forEach(([label, date]) => {
          if (!this.isValidDateString(date)) {
            fail(`${label} "${date}" must use the format YYYY-MM-DD.`);
          }
        });

        imported.push(activity);
      });

      const seen = new Set();

      imported.forEach((activity, index) => {
        if (!activity.id) return;

        if (seen.has(activity.id)) {
          errors.push(`Row ${index + 2}: Duplicate Activity ID "${activity.id}" in the file.`);
        }

        seen.add(activity.id);
      });

      if (errors.length) {
        throw new Error(
          errors.slice(0, 8).join("\n") +
          (errors.length > 8 ? `\n...and ${errors.length - 8} more problems.` : "") +
          "\n\nNo records were imported."
        );
      }

      const existingIds = new Set(this.state.activities.map(activity => activity.id));
      const replacements = imported.filter(activity => existingIds.has(activity.id)).length;

      const message =
        `Validation successful.\n\n` +
        `Records found: ${imported.length}\n` +
        `New records: ${imported.length - replacements}\n` +
        `Existing records to update: ${replacements}\n\n` +
        `Continue with the import?`;

      if (!confirm(message)) return;

      const merged = new Map(
        this.state.activities.map(activity => [activity.id, activity])
      );

      imported.forEach(activity => {
        merged.set(activity.id, { ...merged.get(activity.id), ...activity });
      });

      const previous = this.state.activities;
      this.state.activities = Array.from(merged.values());

      if (!this.saveData()) {
        this.state.activities = previous;
        return;
      }

      alert(`${imported.length} activity records imported successfully.`);
      this.showView("activities");
    } catch (error) {
      console.error("Activity CSV import failed:", error);
      alert("Activity CSV import failed:\n" + error.message);
    }
  },

  // ---------- Restore ----------

  async restoreBackup(file) {
    let backup;
    let restored;

    // Step 1: read and validate the file BEFORE asking to replace anything.
    try {
      backup = JSON.parse(await this.readImportFile(file, ".json"));

      if (
        backup &&
        backup.application &&
        backup.application !== this.name
      ) {
        throw new Error("This backup was not created by Open Quote Recovery Kit.");
      }

      const data = backup && backup.data;

      if (
        !data ||
        !Array.isArray(data.quotes) ||
        !Array.isArray(data.activities) ||
        !data.settings ||
        typeof data.settings !== "object" ||
        Array.isArray(data.settings)
      ) {
        throw new Error("This is not a valid Open Quote Recovery Kit backup.");
      }

      if (data.quotes.some(q => !q || typeof q !== "object") ||
          data.activities.some(a => !a || typeof a !== "object")) {
        throw new Error("The backup contains invalid records.");
      }

      const quoteIds = data.quotes.map(quote => quote.id);

      if (quoteIds.some(id => !id) || new Set(quoteIds).size !== quoteIds.length) {
        throw new Error("The backup contains missing or duplicate Quote IDs.");
      }

      const activityIds = data.activities.map(activity => activity.id);

      if (
        activityIds.some(id => !id) ||
        new Set(activityIds).size !== activityIds.length
      ) {
        throw new Error("The backup contains missing or duplicate Activity IDs.");
      }

      const validQuoteIds = new Set(quoteIds);

      for (const activity of data.activities) {
        if (!validQuoteIds.has(activity.quoteId)) {
          throw new Error(
            `Activity ${activity.id} refers to a Quote ID that is missing from the backup.`
          );
        }
      }

      restored = {
        quotes: data.quotes,
        activities: data.activities,
        settings: this.normalizeSettings(data.settings)
      };
    } catch (error) {
      console.error("Backup restoration failed:", error);
      alert("Unable to restore backup:\n" + error.message);
      return;
    }

    // Step 2: confirm, showing exactly what will be replaced.
    const exportedAt = backup.exportedAt
      ? new Date(backup.exportedAt).toLocaleString()
      : "unknown date";

    const confirmed = confirm(
      `Backup checked successfully (created ${exportedAt}).\n\n` +
      `BACKUP CONTAINS\n` +
      `• ${restored.quotes.length} quotations\n` +
      `• ${restored.activities.length} activities\n\n` +
      `CURRENT DATA (will be REPLACED)\n` +
      `• ${this.state.quotes.length} quotations\n` +
      `• ${this.state.activities.length} activities\n\n` +
      `This cannot be undone. Choose Cancel if you have not downloaded a backup of your current data.\n\n` +
      `Replace all current data with this backup?`
    );

    if (!confirmed) return;

    // Step 3: replace, rolling back if the browser cannot store it.
    const previousState = this.state;
    this.state = restored;

    if (!this.saveData()) {
      this.state = previousState;
      return;
    }

    alert("Backup restored successfully.");
    this.showView("settings");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  ORK.init();
});
