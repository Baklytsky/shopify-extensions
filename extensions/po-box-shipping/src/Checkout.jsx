import {
  reactExtension,
  useSettings,
  useBuyerJourneyIntercept,
  useShippingAddress
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension(
    'purchase.checkout.delivery-address.render-before',
    () => <Extension />,
);

function Extension() {
  const address = useShippingAddress();
  const settings = useSettings();
  const isPOBoxAddress = (address)=> {
    const variationsString = settings.variations_string?.trim();
    if (!variationsString) return null;
    const variationsArray = variationsString
        .split(',')
        .map(variation => variation.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const poBoxRegex = new RegExp(`(?:${variationsArray.join('|')})`, 'i');
    return poBoxRegex.test(address);
  }

  useBuyerJourneyIntercept(({canBlockProgress}) => {
    return canBlockProgress && isPOBoxAddress(address.address1)
      ? {
        behavior: 'block',
        reason: 'Invalid shipping country',
        errors: [
          {
            message: 'Sorry, we do not ship to PO Boxes',
            target: '$.cart.deliveryGroups[0].deliveryAddress.address1',
          }
        ],
      }
      : {
        behavior: 'allow',
      };
  },
  );

  return null;
}