module.exports = {
  extends: [
    "plugin:@shopify/typescript",
    "plugin:@shopify/react",
    "plugin:@shopify/prettier",
    "plugin:@shopify/node",
  ],
  parserOptions: {
    ecmaFeatures: { jsx: true },
  },
};
