const { logger } = require("../../logger");
const Boom = require("@hapi/boom");
const {
  addInventoryServices,
  dashboardDetails,
  warehouseInventory,
  shortExpiryProuductService,
  allWarehouseInventory,
  allWarehouseInventoryCount,
} = require("../services/inventoryService");

const addInventory = async (request, response) => {
  logger.info("Received request");

  try {
    const parts = request.parts(); // Retrieve all parts from the multipart form-data
    let file = null;
    const formData = {};
    
    
    for await (const part of parts) {
      if (part.file) {
        console.log("parttt", await part.toBuffer());
        file = part;
      } else {
        formData[part.fieldname] = part.value; // Collect form data
      }
    }
    console.log("===================");
    console.log(formData);

    // Manual validation of formData and file
    const requiredFields = [
      "product_name",
      "category",
      "quantity",
      "units",
      "expiry_date",
      "threshhold_value",
      "badge_number",
      "barcode_box",
      "barcode_piece",
    ];

    for (const field of requiredFields) {
      if (!formData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!file) {
      throw new Error("No file uploaded");
    }

    const result = await addInventoryServices(file, formData);

    response.code(200).send({
      status: true,
      message: "success",
      data: result,
    });
  } catch (error) {
    logger.error(error.message);
    response.code(400).send({
      status: false,
      message: error.message,
    });
  }
};


const getDashboardDetails = async (request, response) => {
  try {
    const { workplace_id, workplace_type } = request.user;
    const dashboard = await dashboardDetails(workplace_id, workplace_type);
    response.code(200).send({
      status: true,
      message: "success",
      data: dashboard,
    });
  } catch (error) {
    logger.error(error.message);
    response.code(400).send({
      status: false,
      message: error.message,
    });
  }
};

const getWarehouseInventory = async (request, response) => {
  try {
    const { workplace_id, workplace_type } = request.user;
    const { filterBy } = request.query;
    if (!filterBy) throw Boom.badData("Please provide filterBy in parameter");
    const inventory = await warehouseInventory(
      workplace_id,
      workplace_type,
      filterBy
    );
    response.code(200).send({
      status: true,
      message: "success",
      data: inventory,
    });
  } catch (error) {
    logger.error(error.message);
    response.code(400).send({
      status: false,
      message: error.message,
    });
  }
};

const getAllWarehouseInventory = async (request, response) => {
  try {
    const { filterBy } = request.query;
    let inventories;
    if (filterBy === undefined || filterBy === null) {
      inventories = await allWarehouseInventory();
    } else {
      inventories = await allWarehouseInventory(filterBy);
    }
    response.code(200).send({
      status: true,
      message: "success",
      data: inventories,
    });
  } catch (error) {
    logger.error(error.message);
    response.code(400).send({
      status: false,
      message: error.message,
    });
  }
};

const getAllWarehouseInventoryCount = async (request, response) => {
  try {
    const inventories = await allWarehouseInventoryCount();
    response.code(200).send({
      status: true,
      message: "success",
      data: inventories,
    });
  } catch (error) {
    logger.error(error.message);
    response.code(400).send({
      status: false,
      message: error.message,
    });
  }
};

const getShortExpiryProducts = async (request, response) => {
  try {
    const { workplace_id, workplace_type } = request.user;
    const result = await shortExpiryProuductService(
      workplace_id,
      workplace_type
    );
    response.code(200).send({
      status: true,
      message: "success",
      data: result,
    });
  } catch (error) {
    logger.error(error.message);
    response.code(400).send({
      status: false,
      message: error.message,
    });
  }
};

module.exports = {
  addInventory,
  getDashboardDetails,
  getWarehouseInventory,
  getShortExpiryProducts,
  getAllWarehouseInventory,
  getAllWarehouseInventoryCount,
};
