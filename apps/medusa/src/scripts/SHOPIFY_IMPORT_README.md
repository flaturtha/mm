# Importing Shopify Data into Medusa

## 1. Export your Shopify data
- In Shopify, export your products (and optionally customers, orders, etc.) as CSV files from the admin dashboard.

## 2. Write a custom Medusa seed script
- Place your CSV files in a known location (e.g., `apps/medusa/src/scripts/data/`).
- Create a new seed script (e.g., `apps/medusa/src/scripts/seed-shopify.ts`) that:
  - Reads your CSV files (using a library like `csv-parse` or `papaparse`).
  - Uses Medusa's services or repositories to create products, variants, prices, etc.

**Example outline:**
```ts
import { ProductService } from "@medusajs/medusa";
import fs from "fs";
import csvParse from "csv-parse/lib/sync";

export default async function seedShopifyData({ container }) {
  const productService = container.resolve<ProductService>("productService");
  const csv = fs.readFileSync("./src/scripts/data/products.csv", "utf-8");
  const products = csvParse(csv, { columns: true });

  for (const product of products) {
    await productService.create({
      title: product.Title,
      // ...map other fields
    });
  }
}
```
- Register this script in your `package.json` or run it with `ts-node`.

## 3. Run your custom seed script
- Make sure your Medusa backend is stopped.
- Run your script:
  ```sh
  yarn ts-node src/scripts/seed-shopify.ts
  ```
  or
  ```sh
  npx ts-node src/scripts/seed-shopify.ts
  ```

## 4. Restart Medusa and check your products

---

## Resources
- [Medusa seeding docs](https://docs.medusajs.com/development/data/seeding/)
- [Shopify CSV export docs](https://help.shopify.com/en/manual/products/import-export/export-products)
- [Medusa ProductService API](https://docs.medusajs.com/api/services/classes/ProductService/)

---

**If you want, I can help you scaffold a seed script or map your Shopify CSV fields to Medusa's product model. Just let me know!** 