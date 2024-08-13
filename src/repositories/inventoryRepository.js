const _ = require("lodash");
const Boom = require("@hapi/boom");
const { dataSource } = require("../../infrastructure/postgres");

// Function to add a new inventory item
// const addInventory = async (inventoryData) => {
//   const inventoryRepository = dataSource.getRepository("Inventory");
//   // Create a new inventory item with the provided data
//   const newInventory = inventoryRepository.create(inventoryData);
//   // Save the new inventory item to the database
//   return await inventoryRepository.save(newInventory);
// };


const addInventory = async (inventoryData) => {
  const inventoryRepository = dataSource.getRepository("Inventory");
  const productRepository = dataSource.getRepository("Product");
  const categoryRepository = dataSource.getRepository("Category");
  const batchRepository = dataSource.getRepository("Batches");

  // Extracting necessary data from inventoryData
  const {
    image_url,
    product_name,
    category,
    subcategory,
    quantity,
    units,
    expiry_date,
    threshhold_value,
    badge_number,
    barcode_box,
    barcode_piece,
  } = inventoryData;

  // Find or create the product
  let product = await productRepository.findOne({ where: { title: product_name } });
  if (!product) {
    product = productRepository.create({ title: product_name, image_url, barcode_box, barcode_piece });
    await productRepository.save(product);
  }

  // Find or create the category
  let productCategory = await categoryRepository.findOne({ where: { name: category } });
  if (!productCategory) {
    productCategory = categoryRepository.create({ name: category });
    await categoryRepository.save(productCategory);
  }

  // Find or create the batch
  let batch = await batchRepository.findOne({ where: { badge_number } });
  if (!batch) {
    batch = batchRepository.create({ expiry_date, badge_number });
    await batchRepository.save(batch);
  }

  // Create a new inventory item
  const newInventory = inventoryRepository.create({
    product,
    category: productCategory,
    quantity,
    units,
    low_stock_threshold: threshhold_value,
    batches: [batch],
  });

  // Save the new inventory item to the database
  return await inventoryRepository.save(newInventory);
};




// Retrieves the count of low stock items for a specific warehouse.
async function getLowStockItemsCount(warehouse_id) {
  const inventoryRepository = dataSource.getRepository("Inventory");
  const lowStockItems = await inventoryRepository.query(
    `SELECT COUNT(*) AS count FROM inventory 
     WHERE quantity <= low_stock_threshold AND quantity != 0 
     AND warehouse_id = $1 AND is_deleted = $2`,
    [warehouse_id, false]
  );
  return lowStockItems[0];
}

// Retrieves the count of out of stock items for a specific warehouse.
async function getOutOfStockCount(warehouse_id) {
  const inventoryRepository = dataSource.getRepository("Inventory");
  const outOfStock = await inventoryRepository.query(
    `SELECT COUNT(*) AS count FROM inventory 
     WHERE quantity = 0 AND warehouse_id = $1 
     AND is_deleted = $2`,
    [warehouse_id, false]
  );
  return outOfStock[0];
}

// Retrieves the count of items with short expiry dates for a specific warehouse.
const getShortExpiryCount = async (warehouseId, expiryThreshold) => {
  const repository = dataSource.getRepository("Batches");
  const result = await repository
    .createQueryBuilder("batches")
    .leftJoinAndSelect("batches.product", "product")
    .select(["COUNT(batches.id) AS count"])
    .where("batches.warehouse_id = :warehouseId", { warehouseId })
    .andWhere("batches.expiry_date::date <= :expiryDate", {
      expiryDate: expiryThreshold,
    })
    .getRawOne();

  return result;
};

// Retrieves the items with short expiry dates for a specific warehouse.
const getShortExpiryItems = async (warehouseId, expiryThreshold) => {
  const repository = dataSource.getRepository("Batches");
  const result = await repository
    .createQueryBuilder("batches")
    .leftJoinAndSelect("batches.product", "product")
    .select([
      "product.id",
      "product.title",
      "batches.expiry_date",
      "batches.quantity",
    ])
    .where("batches.warehouse_id = :warehouseId", { warehouseId })
    .andWhere("batches.expiry_date::date <= :expiryThreshold", {
      expiryThreshold: expiryThreshold,
    })
    .getMany();

  return result;
};

const findFilteredInventoryAllWarehouses = async (filter, expiryThreshold) => {
  const inventoryRepository = dataSource.getRepository("Inventory");

  const result = inventoryRepository
    .createQueryBuilder("inventory")
    .leftJoinAndSelect("inventory.product", "product")
    .leftJoinAndSelect("inventory.warehouse", "warehouse")
    .leftJoinAndSelect("product.category", "category")
    .leftJoinAndSelect("product.batches", "batches")
    .where(filter)
    .select([
      "inventory.id",
      "inventory.quantity",
      "inventory.low_stock_threshold",
      "product.id",
      "product.title",
      "category.name",
      "batches.batch_number",
      "batches.expiry_date",
      "warehouse.id",
      "warehouse.name",
      "warehouse.location",
    ])
    .getRawMany();

  return result;
};

module.exports = {
  addInventory,
  getLowStockItemsCount,
  getOutOfStockCount,
  getShortExpiryCount,
  getShortExpiryItems,

  findFilteredInventoryAllWarehouses,
};