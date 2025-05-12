import { CheckoutFlow } from '@app/components/checkout/CheckoutFlow';
import { CheckoutSidebar } from '@app/components/checkout/CheckoutSidebar';
import { Empty } from '@app/components/common/Empty/Empty';
import { Button } from '@app/components/common/buttons/Button';
import { CheckoutProvider } from '@app/providers/checkout-provider';
import ShoppingCartIcon from '@heroicons/react/24/outline/ShoppingCartIcon';
import { sdk } from '@libs/util/server/client.server';
import { getCartId, removeCartId } from '@libs/util/server/cookies.server';
import { initiatePaymentSession, retrieveCart, setShippingMethod } from '@libs/util/server/data/cart.server';
import { listCartPaymentProviders } from '@libs/util/server/data/payment.server';
import { CartDTO, StoreCart, StoreCartShippingOption, StorePaymentProvider } from '@medusajs/types';
import { BasePaymentSession } from '@medusajs/types/dist/http/payment/common';
import { LoaderFunctionArgs, redirect } from 'react-router';
import { Link, useLoaderData } from 'react-router';

const SYSTEM_PROVIDER_ID = 'pp_system_default';

const fetchShippingOptions = async (cartId: string) => {
  if (!cartId) return [];

  try {
    const { shipping_options } = await sdk.store.fulfillment.listCartOptions({
      cart_id: cartId,
    });
    return shipping_options;
  } catch (e) {
    console.error(e);
    return [];
  }
};

const findCheapestShippingOption = (shippingOptions: StoreCartShippingOption[]) => {
  return shippingOptions.reduce((cheapest, current) => {
    return cheapest.amount <= current.amount ? cheapest : current;
  }, shippingOptions[0]);
};

const ensureSelectedCartShippingMethod = async (request: Request, cart: StoreCart) => {
  const selectedShippingMethod = cart.shipping_methods?.[0];

  if (selectedShippingMethod) return;

  const shippingOptions = await fetchShippingOptions(cart.id);

  const cheapestShippingOption = findCheapestShippingOption(shippingOptions);

  if (cheapestShippingOption) {
    await setShippingMethod(request, { cartId: cart.id, shippingOptionId: cheapestShippingOption.id });
  }
};

function ensureCartPaymentSessions(request: Request, cart: StoreCart | null) {
  if (!cart) return null;
  // Defensive: check if payment_collection and payment_sessions exist
  const sessions = cart.payment_collection?.payment_sessions ?? [];
  const validSession = sessions.find((s) => s && s.provider_id === 'pp_stripe_stripe');
  if (!validSession) {
    console.warn('No valid Stripe payment session found for cart', cart?.id);
    return null;
  }
  return validSession;
}

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<{
  cart: StoreCart | null;
  shippingOptions: StoreCartShippingOption[];
  paymentProviders: StorePaymentProvider[];
  activePaymentSession: BasePaymentSession | null;
  error?: string;
}> => {
  try {
    const cartId = await getCartId(request.headers);

    if (!cartId) {
      return {
        cart: null,
        shippingOptions: [],
        paymentProviders: [],
        activePaymentSession: null,
      };
    }

    const cart = await retrieveCart(request).catch((e) => null);

    if (!cart) {
      throw redirect('/');
    }

    if ((cart as { completed_at?: string }).completed_at) {
      const headers = new Headers();
      await removeCartId(headers);

      throw redirect(`/`, { headers });
    }

    await ensureSelectedCartShippingMethod(request, cart);

    // Always initiate a Stripe payment session after shipping is set
    const updatedCartAfterShipping = await retrieveCart(request);
    if (!updatedCartAfterShipping) {
      throw redirect('/');
    }
    await initiatePaymentSession(request, updatedCartAfterShipping, {
      provider_id: 'pp_stripe_stripe',
    });

    const [shippingOptions, paymentProviders, activePaymentSession] = await Promise.all([
      await fetchShippingOptions(cartId),
      (await listCartPaymentProviders(cart.region_id!)) as StorePaymentProvider[],
      await ensureCartPaymentSessions(request, updatedCartAfterShipping),
    ]);

    const updatedCart = await retrieveCart(request);

    console.log('[Checkout Loader] Active Payment Session:', activePaymentSession); // Debug line

    return {
      cart: updatedCart,
      shippingOptions,
      paymentProviders: paymentProviders,
      activePaymentSession: activePaymentSession as BasePaymentSession,
    };
  } catch (err: any) {
    console.error('Checkout loader error:', err, err?.stack);
    return {
      cart: null,
      shippingOptions: [],
      paymentProviders: [],
      activePaymentSession: null,
      error: err?.message || 'Unknown error in checkout loader',
    };
  }
};

export default function CheckoutIndexRoute() {
  const { shippingOptions, paymentProviders, activePaymentSession, cart, error } = useLoaderData<typeof loader>();

  if (error) {
    return <div style={{ color: 'red', padding: 32 }}>Checkout error: {error}</div>;
  }

  if (!cart || !cart.items?.length)
    return (
      <Empty
        icon={ShoppingCartIcon}
        title="No items in your cart."
        description="Add items to your cart"
        action={
          <Button variant="primary" as={(buttonProps) => <Link to="/products" {...buttonProps} />}>
            Start shopping
          </Button>
        }
      />
    );

  return (
    <CheckoutProvider
      data={{
        cart: cart as StoreCart | null,
        activePaymentSession: activePaymentSession,
        shippingOptions: shippingOptions,
        paymentProviders: paymentProviders,
      }}
    >
      <section>
        <div className="mx-auto max-w-2xl px-4 pb-8 pt-6 sm:px-6 sm:pb-16 sm:pt-8 lg:max-w-7xl lg:px-8 lg:pb-24 lg:pt-16">
          <div className="lg:grid lg:grid-cols-[4fr_3fr] lg:gap-x-12 xl:gap-x-16">
            <CheckoutFlow />
            <CheckoutSidebar />
          </div>
        </div>
      </section>
    </CheckoutProvider>
  );
}
