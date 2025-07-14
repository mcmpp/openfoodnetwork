module Spree
  class Gateway
    class Twint < Gateway
      include Rails.application.routes.url_helpers
      preference :enterprise_id, :integer

      validate :ensure_enterprise_selected

      def external_gateway?
        true
      end

      def method_type
        'twint'
      end

      def provider_class
        ActiveMerchant::Billing::StripePaymentIntentsGateway
      end

      def payment_profiles_supported?
        true
      end

      def stripe_account_id
        StripeAccount.find_by(enterprise_id: preferred_enterprise_id)&.stripe_user_id
      end

      def external_payment_url(options)
        @order = options[:order]
        @twint_client_secret = create_twint_payment_intent
        @confirm_payment = confirm_payment(@twint_client_secret)
        @order.pending_payments.last.update(response_code: @confirm_payment.id)
        @confirm_payment.next_action.redirect_to_url.url
      end

      def options
        options = super
        options[:stripe_account] = stripe_account_id
        options.merge(login: Stripe.api_key)
      end

      # NOTE: this method is required by Spree::Payment::Processing
      def purchase
        Rails.logger.info("Twint purchase: nothing to do here")
      end

      def confirm_payment(client_secret)
        Rails.logger.info("Executing Twint purchase method for PaymentIntent: #{client_secret}")
        Stripe::PaymentIntent.confirm(
          client_secret,
          {
            return_url: payment_gateways_confirm_twint_url(order_id: @order.number,
                                                           order_token: @order.token),
            payment_method_data: { type: 'twint' }
          }
        )
      end

      def capture_payment(payment_intent_id)
        Stripe::PaymentIntent.capture(payment_intent_id)
      rescue Stripe::StripeError => e
        handle_stripe_error(e)
      end

      def handle_stripe_error(error)
        ActiveMerchant::Billing::Response.new(false, error.message)
      end

      def ensure_enterprise_selected
        return if preferred_enterprise_id&.positive?

        errors.add(:stripe_account_owner, I18n.t(:error_required))
      end

      # This method is only used for Twint payment method
      def create_twint_payment_intent
        payment_intent = Stripe::PaymentIntent.create(
          amount: (@order.total * 100).to_i, # Convert to cents
          currency: 'chf', # Swiss Francs for Twint
          payment_method_types: ['twint'],
        )
        Rails.logger.info( "Stripe PaymentIntent created: #{payment_intent.inspect}")
        payment_intent.id
      rescue Stripe::StripeError => e
        Rails.logger.error("Stripe error: #{e.message}")
        handle_stripe_error(e)
      end
    end
  end
end
