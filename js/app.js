
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

  storageAvailable: false,

  init() {
    this.checkStorage();
    this.loadData();
    this.renderWelcome();

    console.log(
      `${this.name} V${this.version} initialized.`
    );
  },

  checkStorage() {
    try {
      const testKey = "__ork_storage_test__";

      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);

      this.storageAvailable = true;
    } catch (error) {
      this.storageAvailable = false;
      console.error("Browser storage is unavailable.", error);
    }
  },

  loadData() {
    if (!this.storageAvailable) return;

    try {
      const savedData = localStorage.getItem(this.storageKey);

      if (savedData) {
        const parsedData = JSON.parse(savedData);

        this.state = {
          ...this.state,
          ...parsedData,
          settings: {
            ...this.state.settings,
            ...(parsedData.settings || {})
          }
        };
      }
    } catch (error) {
      console.error("Could not load saved data.", error);
    }
  },

  saveData() {
    if (!this.storageAvailable) {
      console.error("Data was not saved: browser storage is unavailable.");
      return false;
    }

    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify(this.state)
      );

      return true;
    } catch (error) {
      console.error("Could not save application data.", error);
      return false;
    }
  },

  renderWelcome() {
    const main = document.getElementById("main-content");

    if (!main) return;

    const paragraph = main.querySelector(".welcome p");

    if (paragraph) {
      paragraph.textContent = this.storageAvailable
        ? "Your workspace is initialized. Your data will be stored in this browser."
        : "Browser storage is unavailable. Your workspace cannot save data on this device.";
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  ORK.init();
});
