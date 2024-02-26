import React, { useState, useEffect, useCallback, useMemo } from "react";
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

const calculateCartSubtotal = (cost) => cost.subtotalAmount.current.amount;
const calculateGwpInCart = (cartLines) => cartLines.filter(lineItem => lineItem.attributes.some(attr => attr.key === "_gwp"));
const calculateGwpIdInCart = (gwpInCart) => gwpInCart.map(lineItem => lineItem.merchandise.id);
const shouldAddItemToCart = (item, cartSubtotal, gwpIdInCart) => {
  const { threshold, id } = item;
  return cartSubtotal >= threshold && !(gwpIdInCart.includes(id));
};
const shouldRemoveItemFromCart = (item, gwpConditions, cartSubtotal) => {
  const { merchandise } = item;
  return !!gwpConditions.find(({ threshold, id }) => id === merchandise.id && cartSubtotal < threshold);
};

function App() {
  const [gwpValue] = useAttributeValues(['__gwp']);
  const gwpConditions = gwpValue ? getGwpConditions(gwpValue) : null;

  console.log(gwpConditions, 'gwpConditions')
  if (!gwpConditions) return null;

  const applyCartLinesChange = useApplyCartLinesChange();
  const cartLines = useCartLines();
  const totalAmount = useTotalAmount();
  const { cost} = useApi();

  const removeFromCart = useCallback((items) => (
    items.map((line) => (
        applyCartLinesChange({
          type: "removeCartLine",
          id: line.id,
          quantity: line.quantity
        })
    ))
  ), [applyCartLinesChange]);

  const addToCart = useCallback((items) => (
      items.map((line) => (
          applyCartLinesChange({
            type: "addCartLine",
            merchandiseId: line.id,
            quantity: 1,
            attributes: [{
              key: "_gwp",
              value: "true",
            }],
          })
      ))
  ), [applyCartLinesChange]);

  const calculateItemsForChange = (cost, cartLines) => {
    const cartSubtotal = calculateCartSubtotal(cost);
    const gwpInCart = calculateGwpInCart(cartLines);
    const gwpIdInCart = calculateGwpIdInCart(gwpInCart);
    const itemsToAdd = gwpConditions.filter(item =>
        shouldAddItemToCart(item, cartSubtotal, gwpIdInCart));
    const itemsToRemove = gwpInCart.filter(item =>
        shouldRemoveItemFromCart(item, gwpConditions, cartSubtotal));

    return [itemsToAdd || [], itemsToRemove || []]
  }

  const memoizedChanges = useMemo(() => calculateItemsForChange(cost, cartLines), [totalAmount.amount, cost, cartLines]);

  const applyCartChanges = (changes) => {
    const [itemsToAdd, itemsToRemove] = changes;
    const cartChangePromises = [];

    if (itemsToAdd.length) cartChangePromises.push(addToCart(itemsToAdd));
    if (itemsToRemove.length) cartChangePromises.push(removeFromCart(itemsToRemove));

    if (cartChangePromises.length) {
      Promise.all(cartChangePromises)
          .then(() => {console.log('GWPs updated')})
          .catch(e => console.error('Error updating GWPs:', e));
    }
  }

  useEffect(() => applyCartChanges(memoizedChanges), [memoizedChanges])

  return null;
}