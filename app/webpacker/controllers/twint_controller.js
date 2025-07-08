import { Controller } from "stimulus";

export default class extends Controller {
  static targets = ["clientSecret", "methodType","orderId", "orderToken" , "pmId" ];

  initialize() {
    if (!this.twintSelected() || this.initialized) return;
    if (this.hasPmIdTarget) {
      this.parentForm = this.pmIdTarget.form;
    }

    this.methodType = this.methodTypeTarget.value;
    this.clientSecret = this.clientSecretTarget?.value; 
    this.orderId = this.orderIdTarget?.value;
    this.orderToken = this.orderTokenTarget?.value;
    this.stripe = Stripe(this.data.get("key"));
    this.initialized = true;
  }

  connect() {
    document.addEventListener("stripecards:initSelectedCard", this.toggleVisibility);
    this.parentForm?.addEventListener("submit", this.twintSubmit);
    this.stripeElement?.addEventListener("change", this.updateErrors);
  }

  disconnect() {
    document.removeEventListener("stripecards:initSelectedCard", this.toggleVisibility);
    this.parentForm?.removeEventListener("submit", this.twintSubmit);
    this.stripeElement?.removeEventListener("change", this.updateErrors);
  }

  twintSubmit = (event) => {
    if ((!this.twintSelected())) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const clientSecret = this.clientSecretTarget.value;
    console.log("TWINT clientSecret:", clientSecret);


    event.submitter.click();
    //const environmentUrl = window.location.origin;
    //this.stripe.confirmTwintPayment(clientSecret, {
    //  payment_method: {
    //  type: "twint"
    //  },
    //  return_url: `${environmentUrl}/orders/${this.orderId}?order_token=${this.orderToken}`,
    //}).then((result) => {
    //  if (result.error) {
    //  this.updateErrors(result);
    //  }
    //});
  }

  updateErrors = (data) => {
    if (data.error && this.hasCardErrorsTarget) {
      this.cardErrorsTarget.textContent = data.error.message;
    }
  };

  // Boolean; true if twint is shown / currently selected
  twintSelected() {
    //const containers = document.getElementsByClassName("paymentmethod-container");
    const checkBoxes = Array.from(document.querySelectorAll('[id^="payment_method_"]'))
      .filter((checkbox) => /^\d+$/.test(checkbox.id.replace('payment_method_', '')));
    const checkedCheckbox = checkBoxes.find((checkbox) => checkbox.checked);
    if (checkedCheckbox && checkedCheckbox.dataset.paymentmethodName === 'twint') {
      return true;
    } else return false; 
  }

  toggleVisibility = (event) => {
  const selectedId = event.detail;
  const myId = this.getMySelectedPaymentMethodId();

  if (selectedId === myId && !this.initialized) {
    this.initialize(); 
  } else {
    this.teardown(); // clean up any existing Stripe Elements
  }
  };

  teardown() {
    if (!this.initialized) return;
    this.twintElement?.unmount();
    this.parentForm?.removeEventListener("submit", this.twintSubmit);
    this.initialized = false;
  }

  getMySelectedPaymentMethodId() {
    const containers = document.getElementsByClassName("paymentmethod-container");
    for (const container of containers) {
      if (container.dataset.paymentmethodName === 'twint') {
        return container.dataset.paymentmethodId;
      }
    }
    return -1;
  }

}