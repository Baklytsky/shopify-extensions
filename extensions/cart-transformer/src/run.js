/*
A straightforward example of a function that expands a bundle into its component parts.
The parts of a bundle are stored in a metafield on the product parent value with a specific format,
specifying each part's quantity and variant.

The function reads the cart. Any item containing the metafield that specifies the bundle parts
will return an Expand operation containing the parts.
*/

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 * @typedef {import("../generated/api").CartOperation} CartOperation
 */

/**
 * @type {FunctionRunResult}
 */
const RESULT = {
  operations: [],
};

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  // Update operation (Set GWP discount)

  const gwpItems = input.cart.lines.filter((lineItem) => {
    const { gwp, merchandise, quantity } = lineItem;
    const isGwp =
      merchandise.__typename === "ProductVariant" &&
      gwp &&
      gwp.value === "true" &&
      quantity < 2;
    return isGwp ? lineItem : false;
  });

  const updateOperations = gwpItems.map((lineItem) => {
    const { id } = lineItem;
    return {
      update: {
        cartLineId: id,
        title: "GWP Item",
        price: {
          adjustment: {
            fixedPricePerUnit: {
              amount: 0,
            },
          },
        },
      },
    };
  });

  if (updateOperations.length) {
    RESULT.operations = [...RESULT.operations, ...updateOperations];
  }

  // Expand operation (Check bundle products)

  const bundleItems = input.cart.lines.filter((lineItem) => {
    const { merchandise } = lineItem;
    const isBundle =
      merchandise.__typename === "ProductVariant" &&
      Boolean(merchandise.product.bundleProductsJSON);
    return isBundle ? lineItem : false;
  });

  const expandOperations = bundleItems.map((lineItem) => {
    const { id, merchandise } = lineItem;
    const bundleProducts = JSON.parse(
      merchandise.product.bundleProductsJSON.value,
    );
    const expandedCartItems = bundleProducts.map((bundleItem) => {
      const { variantId, quantity, price } = bundleItem;

      return {
        merchandiseId: `gid://shopify/ProductVariant/${variantId}`,
        quantity,
        price: {
          adjustment: {
            fixedPricePerUnit: {
              amount: price,
            },
          },
        },
      };
    });

    return {
      expand: {
        cartLineId: id,
        title: "Awesome bundle",
        image: null,
        expandedCartItems,
      },
    };
  });

  if (expandOperations.length) {
    RESULT.operations = [...RESULT.operations, ...expandOperations];
  }

  return RESULT;
}
