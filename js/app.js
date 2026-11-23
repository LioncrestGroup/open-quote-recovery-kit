
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
  searchTerm: "",
  statusFilter: "All",

  statuses: [
    "Draft", "Sent", "Follow-up", "Negotiating",
    "Accepted", "Declined", "Expired", "Closed - No Response"
  ],

  currencies: [
    "USD", "GBP", "EUR", "NGN", "CAD",
    "AUD", "NZD", "ZAR", "AED", "INR"
  ],

  channels: ["Phone", "Email", "SMS", "WhatsApp", "Other"],

  init() {
    this.loadData();

    const main = document.getElementById("main-content");
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
        this.renderQuotes();
      }
    });

    document.addEventListener("submit", event => {
      if (event.target.id === "quote-form") {
        event.preventDefault();
        this.saveQuote(new FormData(event.target));
      }
    });

    document.addEventListener("input", event => {
      if (event.target.id === "quote-search") {
        this.searchTerm = event.target.value.toLowerCase();
        this.renderQuoteTable();
      }
    });

    document.addEventListener("change", event => {
      if (event.target.id === "quote-status-filter") {
        this.statusFilter = event.target.value;
        this.renderQuoteTable();
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

    document.getElementById("page-title").textContent = titles[view];

    document.querySelectorAll(".nav-item[data-view]").forEach(item => {
      item.classList.toggle("active", item.dataset.view === view);
    });

    if (view === "dashboard") {
      document.getElementById("main-content").innerHTML = this.dashboardHTML;
    } else if (view === "quotes") {
      this.renderQuotes();
    } else {
      document.getElementById("main-content").innerHTML =
        this.getPlaceholder(view, titles[view]);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  getPlaceholder(view, title) {
    return `
      <section class="page-heading">
        <div>
          <p class="eyebrow">OPEN QUOTE RECOVERY KIT</p>
          <h1>${title}</h1>
          <p class="page-description">This workspace will be developed in the next build stage.</p>
        </div>
      </section>
      <section class="panel">
        <div class="empty-state">
          <div class="empty-icon">◆</div>
          <strong>${title} is coming next</strong>
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

  formatMoney(amount, currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2
      }).format(Number(amount) || 0);
    } catch {
      return `${currency} ${Number(amount || 0).toFixed(2)}`;
    }
  },

  getFollowUpStatus(quote) {
    if (quote.doNotContact) return "Do not contact";

    if (["Accepted", "Declined", "Expired", "Closed - No Response"]
      .includes(quote.status)) return "Closed";

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
          <input id="quote-search" type="search"
            placeholder="Search customer, business or Quote ID..."
            value="${this.escape(this.searchTerm)}">

          <select id="quote-status-filter">
            <option value="All">All statuses</option>
            ${this.statuses.map(status =>
              `<option value="${status}" ${this.statusFilter === status ? "selected" : ""}>${status}</option>`
            ).join("")}
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

      const matchesSearch = searchText.includes(this.searchTerm);
      const matchesStatus =
        this.statusFilter === "All" || quote.status === this.statusFilter;

      return matchesSearch && matchesStatus;
    });

    document.getElementById("quote-count").textContent =
      `${filtered.length} of ${this.state.quotes.length} quotations`;

    document.getElementById("quote-empty").hidden = filtered.length > 0;
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
      dateSent: new Date().toISOString().slice(0, 10),
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
          <p>${existing ? this.escape(existing.id) : "Enter the customer and quotation details below."}</p>
        </div>
      </div>

      <form id="quote-form">
        <div class="quote-form-grid">
          <label>Customer Name *
            <input name="customerName" required value="${this.escape(quote.customerName)}">
          </label>

          <label>Business Name
            <input name="businessName" value="${this.escape(quote.businessName)}">
          </label>

          <label>Customer Email
            <input name="email" type="email" value="${this.escape(quote.email)}">
          </label>

          <label>Customer Phone
            <input name="phone" type="tel" value="${this.escape(quote.phone)}">
          </label>

          <label class="wide-field">Quote Description *
            <input name="description" required value="${this.escape(quote.description)}">
          </label>

          <label>Quote Amount *
            <input name="amount" type="number" min="0" step="0.01" required value="${this.escape(quote.amount)}">
          </label>

          <label>Currency *
            <select name="currency" required>
              ${this.currencies.map(c =>
                `<option value="${c}" ${quote.currency === c ? "selected" : ""}>${c}</option>`
              ).join("")}
            </select>
          </label>

          <label>Date Sent
            <input name="dateSent" type="date" value="${this.escape(quote.dateSent)}">
          </label>

          <label>Quote Expiry Date
            <input name="expiryDate" type="date" value="${this.escape(quote.expiryDate)}">
          </label>

          <label>Quote Status
            <select name="status">
              ${this.statuses.map(s =>
                `<option value="${s}" ${quote.status === s ? "selected" : ""}>${s}</option>`
              ).join("")}
            </select>
          </label>

          <label>Last Contact Date
            <input name="lastContactDate" type="date" value="${this.escape(quote.lastContactDate)}">
          </label>

          <label>Next Follow-up Date
            <input name="nextFollowUpDate" type="date" value="${this.escape(quote.nextFollowUpDate)}">
          </label>

          <label>Follow-up Channel
            <select name="channel">
              ${this.channels.map(c =>
                `<option value="${c}" ${quote.channel === c ? "selected" : ""}>${c}</option>`
              ).join("")}
            </select>
          </label>

          <label>Assigned To
            <input name="assignedTo" value="${this.escape(quote.assignedTo)}">
          </label>

          <label class="wide-field">Internal Notes
            <textarea name="notes" rows="3">${this.escape(quote.notes)}</textarea>
          </label>

          <label class="checkbox-field wide-field">
            <input name="doNotContact" type="checkbox" ${quote.doNotContact ? "checked" : ""}>
            Do Not Contact — exclude this customer from follow-up priorities
          </label>
        </div>

        <div class="form-actions">
          <button type="button" class="secondary-button" id="cancel-quote-button">Cancel</button>
          <button type="submit" class="primary-button">Save Quotation</button>
        </div>
      </form>
    `;

    container.scrollIntoView({ behavior: "smooth", block: "start" });
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

    if (!confirm(`Delete quotation ${id} for ${quote.customerName}?`)) return;

    this.state.quotes = this.state.quotes.filter(q => q.id !== id);

    if (this.saveData()) {
      this.renderQuotes();
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  ORK.init();
});
