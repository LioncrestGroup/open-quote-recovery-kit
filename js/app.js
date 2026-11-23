
/*
 * Open Quote Recovery Kit
 * Interactive Web Application V1.0
 */

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

  init() {
    this.loadData();
    this.dashboardHTML =
      document.getElementById("main-content").innerHTML;

    this.bindNavigation();
    this.showView("dashboard");

    console.log(`${this.name} V${this.version} initialized.`);
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
      console.error("Unable to save data:", error);
      return false;
    }
  },

  bindNavigation() {
    document.addEventListener("click", (event) => {
      const navigation = event.target.closest("[data-view]");

      if (navigation) {
        event.preventDefault();
        this.showView(navigation.dataset.view);
        return;
      }

      if (event.target.closest("#add-quote-button")) {
        this.showView("quotes");
      }
    });
  },

  showView(view) {
    const main = document.getElementById("main-content");
    const title = document.getElementById("page-title");

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

    if (view === "dashboard") {
      main.innerHTML = this.dashboardHTML;
    } else {
      main.innerHTML = this.getPageTemplate(view);
    }

    title.textContent = titles[view];

    document.querySelectorAll(".nav-item[data-view]")
      .forEach((item) => {
        item.classList.toggle(
          "active",
          item.dataset.view === view
        );
      });

    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  getPageTemplate(view) {
    const pages = {
      quotes: {
        eyebrow: "CUSTOMER MANAGEMENT",
        title: "Quote Register",
        description: "Create, organise and monitor your customer quotations.",
        message: "Your quotation register will be built here.",
        detail: "You'll be able to add, edit, search and manage quotations."
      },

      planner: {
        eyebrow: "FOLLOW-UP MANAGEMENT",
        title: "Follow-up Planner",
        description: "Stay on top of every customer follow-up.",
        message: "Your follow-up schedule is ready to be built.",
        detail: "Upcoming, due-today and overdue quotations will appear here."
      },

      activities: {
        eyebrow: "CUSTOMER INTERACTIONS",
        title: "Activity Log",
        description: "Keep a history of your quotation follow-up activities.",
        message: "Your activity history will appear here.",
        detail: "Record calls, emails, messages and customer responses."
      },

      messages: {
        eyebrow: "COMMUNICATION",
        title: "Message Generator",
        description: "Prepare professional quotation follow-up messages.",
        message: "Your message generator will be built here.",
        detail: "Create personalised messages for email, SMS and WhatsApp."
      },

      analytics: {
        eyebrow: "BUSINESS PERFORMANCE",
        title: "Recovery Analytics",
        description: "Understand quotation outcomes and accepted business.",
        message: "Your recovery analytics will appear here.",
        detail: "Track acceptance rates, quotation value and follow-up performance."
      },

      settings: {
        eyebrow: "PREFERENCES",
        title: "Settings",
        description: "Configure your workspace and manage your data.",
        message: "Your application settings will be available here.",
        detail: "Manage business details, currencies, backups and data preferences."
      }
    };

    const page = pages[view];

    return `
      <section class="page-heading">
        <div>
          <p class="eyebrow">${page.eyebrow}</p>
          <h1>${page.title}</h1>
          <p class="page-description">${page.description}</p>
        </div>
      </section>

      <section class="panel">
        <div class="empty-state">
          <div class="empty-icon">◆</div>
          <strong>${page.message}</strong>
          <p>${page.detail}</p>
        </div>
      </section>

      <footer class="app-footer">
        <span>Open Quote Recovery Kit</span>
        <span>Version 1.0.0</span>
      </footer>
    `;
  }
};

document.addEventListener("DOMContentLoaded", () => {
  ORK.init();
});
