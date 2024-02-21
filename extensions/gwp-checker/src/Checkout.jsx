import React, {useEffect, useCallback, useMemo} from "react";
import {
  reactExtension,
  useApi,
  useApplyCartLinesChange,
  useAttributeValues,
  useCartLines,
  useTotalAmount
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension("purchase.checkout.block.render", () => <App/>);

function getGwpConditions(value) {
  if (!value) return null;
  const replacedStr = value.replace(/\\"/g, '"').replace(/"=>"/g, '": "').replace(/"=>/g, '":');

  try {
    const parsedData = JSON.parse(replacedStr);
    return (typeof parsedData === 'object' && parsedData !== null) ? Object.values(parsedData) : null;
  } catch (error) {
    console.error('Error parsing JSON:', error.message);
    return null;
  }
}

function App() {
  const [gwpValue] = useAttributeValues(['__gwp']);
  const gwpConditions = gwpValue ? getGwpConditions(gwpValue) : null;

  console.log(gwpConditions, 'gwpConditions')

  if (!gwpConditions) return;

  const applyCartLinesChange = useApplyCartLinesChange();
  const cartLines = useCartLines();
  const totalAmount = useTotalAmount();
  const {cost} = useApi();

  const removeFromCart = useCallback((items) => {
    return items.map((line) => (
        applyCartLinesChange({
          type: "removeCartLine",
          id: line.id,
          quantity: line.quantity
        })
    ));
  }, [applyCartLinesChange]);

  const addToCart = useCallback((items) => {
    return items.map((line) => (
        applyCartLinesChange({
          type: "addCartLine",
          merchandiseId: line.id,
          quantity: 1,
          attributes: [{
            key: "_gwp",
            value: "true",
          }],
        })
    ));
  }, [applyCartLinesChange]);

  const memoizeGwpItems = useMemo(() => {
    const cartTotal = cost.totalAmount.current.amount;
    const gwpInCart = cartLines.filter(lineItem => (
        lineItem.attributes.some(attr => attr.key === "_gwp")
    ));
    const gwpIdInCart = gwpInCart.map(lineItem => lineItem.merchandise.id);
    const itemsToAdd = gwpConditions.filter(condition => (
        cartTotal >= condition.threshold && !gwpIdInCart.includes(condition.id)
    ));
    const itemsToRemove = gwpInCart.filter(lineItem => (
        gwpConditions.find(condition => condition.id === lineItem.merchandise.id && cartTotal <= condition.threshold)
    ));

    return {itemsToAdd, itemsToRemove};
  }, [totalAmount]);


  useEffect(() => {
    const {itemsToAdd, itemsToRemove} = memoizeGwpItems;
    const addToCartPromise = itemsToAdd.length ? addToCart(itemsToAdd) : Promise.resolve();
    const removeFromCartPromise = itemsToRemove.length ? removeFromCart(itemsToRemove) : Promise.resolve();

    Promise.all([addToCartPromise, removeFromCartPromise])
        .then(() => console.log('GWPs updated'))
        .catch(error => console.error('Error updating GWPs:', error));
  }, [memoizeGwpItems])

  return null;
}