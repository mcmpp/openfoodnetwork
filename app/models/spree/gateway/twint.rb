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
        # @order_id = @order.number
        # @order_token = @order.token
        #   stripe_payment_url = "https://checkout.stripe.com/pay/#{@twint_client_secret}"
        #   Rails.logger.info("Redirecting to Stripe Twint payment page: #{stripe_payment_url}")
        #   stripe_payment_url
        @twint_client_secret = create_twint_payment_intent
        @confirm_payment = confirm_payment(@twint_client_secret)
        @order.pending_payments.last.update(response_code: @confirm_payment.id)
        Rails.logger.info("redirect to : #{@purchase.inspect}")
        @confirm_payment.next_action.redirect_to_url.url
      end

      def options
        options = super
        options.merge(login: Stripe.api_key)
      end

      def basic_options(gateway_options)
        options = {}
        options[:stripe_account] = stripe_account_id
        options
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

      #      def fetch_payment_intent(gateway_options)
      #        payment = fetch_payment(creditcard, gateway_options)
      #        raise Stripe::StripeError, I18n.t(:no_pending_payments) unless payment&.response_code
      #
      #        payment_intent_response = Stripe::PaymentIntentValidator.new(payment).call
      #
      #        raise_if_not_in_capture_state(payment_intent_response)
      #
      #        payment.response_code
      #      end
      #
      # def confirm_payment(client_secret)
      #  Stripe::PaymentIntent.confirm(client_secret)
      # rescue Stripe::StripeError => e
      #  handle_stripe_error(e)
      # end

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

      # def create_twint_payment_method
      #  stripe_account = stripe_account_id
      #  unless stripe_account
      #    raise "No Stripe account associated with the enterprise"
      #  end

      #  payment_method = Stripe::PaymentMethod.create({
      #                                                  type: 'twint',
      #                                                }, {
      #                                                  stripe_account:
      #                                                })
      #  Rails.logger.info("Stripe PaymentMethod created: #{payment_method.inspect}")
      #  payment_method.id
      # rescue Stripe::StripeError => e
      #  Rails.logger.error("Stripe error while creating PaymentMethod: #{e.message}")
      #  handle_stripe_error(e)
      # end

      # This method is only used for Twint payment method
      def create_twint_payment_intent
        # Create a Stripe PaymentMethod for Twint
        # payment_method_id = create_twint_payment_method
        # unless payment_method_id
        #  raise "Failed to create Stripe PaymentMethod for Twint"
        # end
        # unless payment_method_id
        #  raise "No payment method associated with the order"
        # end

        stripe_account = stripe_account_id
        unless stripe_account
          raise "No Stripe account associated with the enterprise"
        end

        # Rails.logger.info("Generated return_url: #{payment_gateways_confirm_twint_url(
        #  order_id: @order.number, order_token: @order.token
        # )}")
        payment_intent = Stripe::PaymentIntent.create(
          amount: (@order.total * 100).to_i, # Convert to cents
          currency: 'chf', # Swiss Francs for Twint
          payment_method_types: ['twint'],
          # metadata: { order_id: @order.id },
          # confirm: true,
          # payment_method: payment_method_id,
          # return_url: payment_gateways_confirm_twint_url(order_id: @order.number,
          #                                               order_token: @order.token)
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
