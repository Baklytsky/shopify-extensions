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

const calculateCartSubtotal = (cost) => cost.subtotalAmount.current.amount;
const calculateGwpInCart = (cartLines) => cartLines.filter(lineItem => lineItem.attributes.some(attr => attr.key === "_gwp"));
const calculateGwpIdInCart = (gwpInCart) => gwpInCart.map(lineItem => lineItem.merchandise.id);

function App() {
  const [gwpValue] = useAttributeValues(['__gwp']);
  const gwpConditions = gwpValue ? getGwpConditions(gwpValue) : null;

  console.log(gwpConditions, 'gwpConditions')
  if (!gwpConditions) return null;

  const applyCartLinesChange = useApplyCartLinesChange();
  const cartLines = useCartLines();
  const totalAmount = useTotalAmount();
  const { cost} = useApi();
  const [promisesCompleted, setPromisesCompleted] = useState(false);

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

  const calculateItemsForChange = () => {
    const cartSubtotal = calculateCartSubtotal(cost);
    const gwpInCart = calculateGwpInCart(cartLines);
    const gwpIdInCart = calculateGwpIdInCart(gwpInCart);

    const itemsToAdd = gwpConditions.filter(
        condition => cartSubtotal >= condition.threshold && !gwpIdInCart.includes(condition.id));
    const itemsToRemove = gwpInCart.filter(
        lineItem => gwpConditions.find(condition => condition.id === lineItem.merchandise.id && cartSubtotal < condition.threshold));

    return [itemsToAdd, itemsToRemove]
  }


  const memoizedChanges = useMemo(() => calculateItemsForChange(), [totalAmount, cartLines]);

  const applyCartChanges = () => {
    const [itemsToAdd, itemsToRemove] = memoizedChanges;
    const cartChangePromises = [];

    if (itemsToAdd.length) cartChangePromises.push(addToCart(itemsToAdd));
    if (itemsToRemove.length) cartChangePromises.push(removeFromCart(itemsToRemove));
    if (cartChangePromises.length && !promisesCompleted) {
      setPromisesCompleted(false);
      Promise.all(cartChangePromises)
          .then(() => {
            setPromisesCompleted(true);
            console.log('GWPs updated');
          })
          .catch(error => console.error('Error updating GWPs:', error));
    }
  }

  useEffect(() => applyCartChanges(), [memoizedChanges])

  return null;
}