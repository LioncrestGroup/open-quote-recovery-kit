"use strict";

const ORK = {
  name: "Open Quote Recovery Kit",
  version: "1.0.0",
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

  statuses: [
    "Draft",
    "Sent",
    "Follow-up",
    "Negotiating",
    "Accepted",
    "Declined",
    "Expired",
    "Closed - No Response"
  ],

  currencies: [
    "USD", "GBP", "EUR", "NGN", "CAD",
    "AUD", "NZD", "ZAR", "AED", "INR"
  ],

  channels: [
    "Phone", "Email", "SMS", "WhatsApp", "Other"
  ],

  activityTypes: [
    "Initial Follow-up",
    "Phone Call",
    "Email",
    "SMS",
    "WhatsApp",
    "Customer Response",
    "Negotiation",
    "Other"
  ],

  activityOutcomes: [
    "No Answer",
    "Message Sent",
    "Interested",
    "Requested More Information",
    "Negotiating",
    "Accepted",
    "Declined",
    "Callback Requested",
    "No Further Contact",
    "Other"
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

  loadData() {
    try {
      const saved = localStorage.getItem(this.storageKey);

      if (saved) {
        const data = JSON.parse(saved);

        this.state = {
          ...this.state,
          ...data,
          settings: {
            ...this.state.settings,
            ...(data.settings || {})
          }
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

      return true;
    } catch (error) {
      alert("Your data could not be saved. Check browser storage.");
      console.error(error);
      return false;
    }
  },

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
    } else if (view === "quotes") {
      this.renderQuotes();
    } else if (view === "planner") {
      this.renderPlanner();
    } else if (view === "activities") {
      this.renderActivities();
    } else {
      main.innerHTML = this.getPlaceholder(view, titles[view]);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
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
      "Accepted",
      "Declined",
      "Expired",
      "Closed - No Response"
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
          <input
            id="quote-search"
            type="search"
            placeholder="Search customer, business or Quote ID..."
            value="${this.escape(this.searchTerm)}"
          >

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
        quote.id,
        quote.customerName,
        quote.businessName,
        quote.description,
        quote.email,
        quote.phone
      ].join(" ").toLowerCase();

      const matchesSearch = searchText.includes(this.searchTerm);

      const matchesStatus =
        this.statusFilter === "All" ||
        quote.status === this.statusFilter;

      return matchesSearch && matchesStatus;
    });

    document.getElementById("quote-count").textContent =
      `${filtered.length} of ${this.state.quotes.length} quotations`;

    document.getElementById("quote-empty").hidden =
      filtered.length > 0;

    body.innerHTML = "";

    filtered.forEach(quote => {
      const row = document.createElement("tr");
      const followUpStatus = this.getFollowUpStatus(quote);

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
        <td>${this.escape(followUpStatus)}</td>

        <td class="quote-actions">
          <button class="small-button"
            data-edit-quote="${this.escape(quote.id)}">
            Edit
          </button>

          <button class="small-button delete-button"
            data-delete-quote="${this.escape(quote.id)}">
            Delete
          </button>
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

    const container = document.getElementById("quote-form-container");

    container.hidden = false;

    container.innerHTML = `
      <div class="panel-heading">
        <div>
          <h2>${existing ? "Edit Quotation" : "Add New Quotation"}</h2>
          <p>
            ${existing
              ? this.escape(existing.id)
              : "Enter the customer and quotation details below."}
          </p>
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
              step="0.01" required
              value="${this.escape(quote.amount)}">
          </label>

          <label>Currency *
            <select name="currency" required>
              ${this.currencies.map(c => `
                <option value="${c}"
                  ${quote.currency === c ? "selected" : ""}>
                  ${c}
                </option>
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
                  ${quote.status === s ? "selected" : ""}>
                  ${s}
                </option>
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
                  ${quote.channel === c ? "selected" : ""}>
                  ${c}
                </option>
              `).join("")}
            </select>
          </label>

          <label>Assigned To
            <input name="assignedTo"
              value="${this.escape(quote.assignedTo)}">
          </label>

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
            id="cancel-quote-button">
            Cancel
          </button>

          <button type="submit" class="primary-button">
            Save Quotation
          </button>
        </div>
      </form>
    `;

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
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

    if (!confirm(
      `Delete quotation ${id} for ${quote.customerName}?`
    )) {
      return;
    }

    this.state.quotes = this.state.quotes.filter(q => q.id !== id);

    if (this.saveData()) {
      this.renderQuotes();
    }
  },

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
          <input
            id="activity-search"
            type="search"
            placeholder="Search activity, customer or Quote ID..."
            value="${this.escape(this.activitySearchTerm)}"
          >

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
          <p>
            Log your first customer interaction or adjust your search.
          </p>
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
          activity.id,
          activity.quoteId,
          activity.customerName,
          activity.activityType,
          activity.channel,
          activity.outcome,
          activity.nextAction,
          activity.assignedTo,
          activity.notes
        ].join(" ").toLowerCase();

        const matchesSearch =
          searchText.includes(this.activitySearchTerm);

        const matchesType =
          this.activityTypeFilter === "All" ||
          activity.activityType === this.activityTypeFilter;

        return matchesSearch && matchesType;
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
            data-edit-activity="${this.escape(activity.id)}">
            Edit
          </button>

          <button class="small-button delete-button"
            data-delete-activity="${this.escape(activity.id)}">
            Delete
          </button>
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
          <p>
            ${existing
              ? `Editing ${this.escape(existing.id)}`
              : "Record a customer interaction against an existing quotation."}
          </p>
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
            <input
              name="customerName"
              id="activity-customer-name"
              value="${this.escape(activity.customerName)}"
              readonly
              placeholder="Automatically filled from Quote ID"
            >
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
            id="cancel-activity-button">
            Cancel
          </button>

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

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  },

  updateActivityCustomerName(quoteId) {
    const customerInput =
      document.getElementById("activity-customer-name");

    if (!customerInput) return;

    const quote = this.state.quotes.find(
      item => item.id === quoteId
    );

    customerInput.value = quote
      ? quote.customerName || ""
      : "";
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

    // Update the linked quotation using the saved interaction.
    quote.lastContactDate = data.date;

    if (data.nextFollowUpDate) {
      quote.nextFollowUpDate = data.nextFollowUpDate;
    }

    if (data.channel) {
      quote.channel = data.channel;
    }

    if (data.assignedTo) {
      quote.assignedTo = data.assignedTo;
    }

    // Apply customer decisions and contact preferences.
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
    const activity = this.state.activities.find(
      item => item.id === id
    );

    if (!activity) return;

    const confirmed = confirm(
      `Delete activity ${id} for ${activity.customerName}?`
    );

    if (!confirmed) return;

    this.state.activities = this.state.activities.filter(
      item => item.id !== id
    );

    if (this.saveData()) {
      this.renderActivities();
    }
  },

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
          "Accepted",
          "Declined",
          "Expired",
          "Closed - No Response"
        ].includes(quote.status) &&
        Boolean(quote.nextFollowUpDate);
    });

    const groups = [
      {
        title: "Overdue",
        description: "Follow-ups that have passed their scheduled date.",
        className: "planner-overdue",
        quotes: activeQuotes.filter(q =>
          q.nextFollowUpDate < todayKey
        )
      },
      {
        title: "Due Today",
        description: "Customers who need attention today.",
        className: "planner-today",
        quotes: activeQuotes.filter(q =>
          q.nextFollowUpDate === todayKey
        )
      },
      {
        title: "Next 7 Days",
        description: "Follow-ups scheduled within the next seven days.",
        className: "planner-soon",
        quotes: activeQuotes.filter(q =>
          q.nextFollowUpDate > todayKey &&
          q.nextFollowUpDate <= sevenDaysLater
        )
      },
      {
        title: "Upcoming",
        description: "Follow-ups scheduled beyond the next seven days.",
        className: "planner-upcoming",
        quotes: activeQuotes.filter(q =>
          q.nextFollowUpDate > sevenDaysLater
        )
      }
    ];

    const total = groups.reduce(
      (sum, group) => sum + group.quotes.length,
      0
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
        "Accepted",
        "Declined",
        "Expired",
        "Closed - No Response"
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
          <span>Active Follow-ups</span>
          <strong>${total}</strong>
        </div>

        <div class="planner-summary-card">
          <span>Overdue</span>
          <strong>${groups[0].quotes.length}</strong>
        </div>

        <div class="planner-summary-card">
          <span>Due Today</span>
          <strong>${groups[1].quotes.length}</strong>
        </div>

        <div class="planner-summary-card">
          <span>Needs a Date</span>
          <strong>${unscheduled}</strong>
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
  }
};

document.addEventListener("DOMContentLoaded", () => {
  ORK.init();
});
