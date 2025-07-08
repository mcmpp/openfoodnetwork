import { Controller } from "stimulus";

export default class extends Controller {
  static targets = [
    "cardElement",
    "cardErrors",
    "expMonth",
    "expYear",
    "brand",
    "last4",
    "pmId",
  ];
  static styles = {
    base: {
      fontFamily: "Roboto, Arial, sans-serif",
      fontSize: "16px",
      color: "#5c5c5c",
      "::placeholder": {
        color: "#6c6c6c",
      },
    },
  };

  initialize() {
    if (!this.stripeSelected() || this.initialized) return;
    if (this.hasPmIdTarget) {
      this.parentForm = this.pmIdTarget.form;
    }
    this.catchFormSubmit = true;

    // Initialize Stripe JS
    this.stripe = Stripe(this.data.get("key"));
    this.stripeElement = this.stripe
      .elements({ locale: I18n.base_locale })
      .create("card", {
        style: this.constructor.styles,
        hidePostalCode: true,
      });

    // Mount Stripe Elements JS to the form field
    this.stripeElement.mount(this.cardElementTarget);
    this.initialized = true;
  }

  connect() {
    document.addEventListener("stripecards:initSelectedCard", this.toggleVisibility);
    this.parentForm?.addEventListener("submit", this.stripeSubmit);
    this.stripeElement?.addEventListener("change", this.updateErrors);
  }

  disconnect() {
    document.removeEventListener("stripecards:initSelectedCard", this.toggleVisibility);
    this.parentForm?.removeEventListener("submit", this.stripeSubmit);
    this.stripeElement?.removeEventListener("change", this.updateErrors);
  }

  // Before the form is submitted we send the card details directly to Stripe (via StripeJS),
  // and receive a token which represents the card object, and add that token into the form.
  stripeSubmit = (event) => {
    if ((!this.stripeSelected()) && !this.catchFormSubmit) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.stripe
      .createPaymentMethod({ type: "card", card: this.stripeElement })
      .then((response) => {
        if (response.error) {
          this.updateErrors(response);
        } else {
          this.pmIdTarget.setAttribute("value", response.paymentMethod.id);
          this.expMonthTarget.setAttribute(
            "value",
            response.paymentMethod.card.exp_month
          );
          this.expYearTarget.setAttribute(
            "value",
            response.paymentMethod.card.exp_year
          );
          this.brandTarget.setAttribute(
            "value",
            response.paymentMethod.card.brand
          );
          this.last4Target.setAttribute(
            "value",
            response.paymentMethod.card.last4
          );
          this.catchFormSubmit = false;

          event.submitter.click();
        }
      });
  };

  // Update validation messages from Stripe shown in the form
  updateErrors = (data) => {
    if (data.error) {
      this.cardErrorsTarget.textContent = data.error.message;
    } else {
      this.cardErrorsTarget.textContent = "";
    }
  };

  // Boolean; true if Stripe is shown / currently selected
  stripeSelected() {
  //  const containers = document.getElementsByClassName("paymentmethod-container");
    const checkBoxes = Array.from(document.querySelectorAll('[id^="payment_method_"]'))
      .filter((checkbox) => /^\d+$/.test(checkbox.id.replace('payment_method_', '')));
    const checkedCheckbox = checkBoxes.find((checkbox) => checkbox.checked);
    if (checkedCheckbox && checkedCheckbox.dataset.paymentmethodName === 'card') {
      return true;
    } else return false; 
  }

  getSelectedPaymentMethodId() {
    const checkedRadio = document.querySelector(
      'input[name="order[payments_attributes][][payment_method_id]"]:checked'
    );
    return checkedRadio?.value;
  }

  toggleVisibility = (event) => {
    const selectedId = event.detail;
    const myId = this.getMySelectedPaymentMethodId();

    if (selectedId === myId && !this.initialized ) {
      this.initialize(); 
    } else {
      this.teardown();
    }
  };


  teardown() {
    if (!this.initialized) return;
    this.stripeElement?.unmount();
    this.parentForm?.removeEventListener("submit", this.stripeSubmit);
    this.initialized = false;
  }

  getMySelectedPaymentMethodId() {
    const containers = document.getElementsByClassName("paymentmethod-container");
    for (const container of containers) {
      if (container.dataset.paymentmethodName === 'card') {
        return container.dataset.paymentmethodId;
      }
    }
    return -1;
  }


}
