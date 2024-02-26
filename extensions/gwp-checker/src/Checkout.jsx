import React, {useState, useEffect, useCallback, useMemo } from "react";
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
  const replacedStr = value
      .replace(/\\"/g, '"')
      .replace(/"=>"/g, '": "')
      .replace(/"=>/g, '":');

  try {
    const parsedData = JSON.parse(replacedStr);
    return parsedData && typeof parsedData === "object" ? Object.values(parsedData) : null;
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
  const quantityInCart = cartLines.reduce((acc, item) => item.quantity + acc, 0);
  const totalAmount = useTotalAmount();
  const { cost} = useApi();
  const [itemsToAdd, setItemsToAdd] = useState([]);
  const [itemsToRemove, setItemsToRemove] = useState([]);

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
            key: "_free-gift",
            value: "true",
          }],
        })
    ));
  }, [applyCartLinesChange]);

  const getItemsForChange = () => {
    const cartTotal = cost.subtotalAmount.current.amount;
    const gwpInCart = cartLines.filter(lineItem => (
        lineItem.attributes.some(attr => attr.key === "_free-gift")
    ));
    const gwpIdInCart = gwpInCart.map(lineItem => lineItem.merchandise.id);
    const gwpToAdd = gwpConditions.filter(
        condition => (cartTotal >= condition.threshold && !gwpIdInCart.includes(condition.id)
        ));
    const gwpToRemove = gwpInCart.filter(lineItem => (
        gwpConditions.find(
            condition => condition.id === lineItem.merchandise.id && cartTotal < condition.threshold)
    ));

    setItemsToAdd(gwpToAdd);
    setItemsToRemove(gwpToRemove);
  }


  useMemo(() => getItemsForChange(), [totalAmount.amount, quantityInCart]);

  const applyCartChanges = () => {
    const addToCartPromise = itemsToAdd.length ? addToCart(itemsToAdd) : Promise.resolve();
    const removeFromCartPromise = itemsToRemove.length ? removeFromCart(itemsToRemove) : Promise.resolve();

    Promise.all([addToCartPromise, removeFromCartPromise])
        .then(() => console.log('GWPs updated'))
        .catch(error => console.error('Error updating GWPs:', error));
  }

  useEffect(() => applyCartChanges(), [itemsToAdd, itemsToRemove])

  return null;
}