module.exports = (sequelize, Sequelize) => {
  const AccountToken = sequelize.define('AccountToken', {
    value: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
    },
  }, {
    classMethods: {
      associate: ({Account}) => {
        AccountToken.belongsTo(Account, {
          onDelete: "CASCADE",
          foreignKey: {
            allowNull: false,
          },
        });
      },
    },
  });

  return AccountToken;
};
