const _ = require("lodash");
const Boom = require("@hapi/boom");
const { dataSource } = require("../../infrastructure/postgres");
const addInventory = async (inventoryData) => {
  const inventoryRepository = dataSource.getRepository("Inventory");
  const productRepository = dataSource.getRepository("Product");
  const categoryRepository = dataSource.getRepository("Category");
  const subCategoryRepository = dataSource.getRepository("SubCategory");
  const batchRepository = dataSource.getRepository("Batches");
  const warehouseRepository = dataSource.getRepository("Warehouse");

  const {
    image_url,
    product_name,
    category_id,
    sub_category_id,
    quantity,
    units,
    expiry_date,
    threshhold_value,
    batch_number,
    barcode_box,
    barcode_piece,
    unit_price,
    selling_price,
    warehouse_id,
  } = inventoryData;

  console.log("======");
  console.log(inventoryData);

  const productCategory = await categoryRepository.findOne({ where: { id: category_id } });
  if (!productCategory) {
    throw new Error(`Category with id ${category_id} not found.`);
  }

  const productSubCategory = await subCategoryRepository.findOne({ where: { id: sub_category_id } });
  if (!productSubCategory) {
    throw new Error(`Sub-category with id ${sub_category_id} not found.`);
  }

  if (unit_price == null) {
    throw new Error("Unit price is required.");
  }

  if (selling_price == null) {
    throw new Error("Selling price is required.");
  }

  let product = await productRepository.findOne({ where: { title: product_name } });
  if (!product) {
    product = productRepository.create({
      title: product_name,
      thumbnail_image_url: image_url,
      box_barcode: barcode_box,
      unit_barcode: barcode_piece,
      category: productCategory,
      sub_category: productSubCategory,
      category_id: productCategory.id,
      sub_category_id: productSubCategory.id,
      
      pack_of: units,
      unit_price,
      selling_price
    });
    await productRepository.save(product);
  } else {
    if (!product.category || !product.sub_category) {
      product.category = productCategory;
      product.sub_category = productSubCategory;
      await productRepository.save(product);
    }
  }

  const productId = product.id;
  const warehouse = await warehouseRepository.findOne({ where: { id: warehouse_id } });
  if (!warehouse) {
    throw new Error(`Warehouse with id ${warehouse_id} not found.`);
  }
  const warehouseId = warehouse.id;

  let batch = await batchRepository.findOne({ where: { batch_number, product: { id: productId } } });
  if (!batch) {
    batch = batchRepository.create({
      expiry_date,
      batch_number,
      quantity,
      product: { id: productId },
      warehouse: { id: warehouseId }
    });
    await batchRepository.save(batch);
  }

  const newInventory = inventoryRepository.create({
    product,
    warehouse,
    quantity,
    units,
    low_stock_threshold: threshhold_value,
    batches: [batch],
    unit_price,
    selling_price,
  });

  return await inventoryRepository.save(newInventory);
};

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