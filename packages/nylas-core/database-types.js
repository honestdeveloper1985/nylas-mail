const Sequelize = require('sequelize');

module.exports = {
  JSONType: (fieldName, {defaultValue = '{}'} = {}) => ({
    type: Sequelize.TEXT,
    defaultValue,
    get: function get() {
      return JSON.parse(this.getDataValue(fieldName))
    },
    set: function set(val) {
      this.setDataValue(fieldName, JSON.stringify(val));
    },
  }),
  JSONARRAYType: (fieldName, {defaultValue = '[]'} = {}) => ({
    type: Sequelize.TEXT,
    defaultValue,
    get: function get() {
      return JSON.parse(this.getDataValue(fieldName))
    },
    set: function set(val) {
      this.setDataValue(fieldName, JSON.stringify(val));
    },
  }),
}
