'use strict';

const utils = require('./utils')
  , graphqlRoot = require('graphql')
  , GraphQLInt = graphqlRoot.GraphQLInt
  , GraphQLList = graphqlRoot.GraphQLList
  , GraphQLEnumType = graphqlRoot.GraphQLEnumType
  , GraphQLBoolean = graphqlRoot.GraphQLBoolean
  , GraphQLObjectType = graphqlRoot.GraphQLObjectType;

module.exports = (argNameMap, opt) => {
  return [
    basicOperator('=', ''),
    basicOperator('=', argNameMap.eq),
    basicOperator('>', argNameMap.gt),
    basicOperator('>=', argNameMap.gte),
    basicOperator('<', argNameMap.lt),
    basicOperator('<=', argNameMap.lte),
    basicOperator('like', argNameMap.like),
    isNull(argNameMap.isNull),
    whereIn('whereIn', argNameMap.in),
    whereIn('whereNotIn', argNameMap.notIn),
    likeNoCase(argNameMap.likeNoCase),
    orderBy(argNameMap.orderBy, 'asc', opt.typeCache),
    orderBy(argNameMap.orderByDesc, 'desc', opt.typeCache),
    range(argNameMap.range)
  ];
};

function basicOperator(op, postfix) {
  return (fields, modelClass) => {
    return reducePrimitiveFields(fields, modelClass, (args, field, propName, columnName) => {
      args[propName + postfix] = {
        type: field.type,

        query(query, value) {
          query.where(fullCol(columnName, modelClass), op, value);
        }
      };

      return args;
    });
  };
}

function isNull(postfix) {
  return (fields, modelClass) => {
    return reducePrimitiveFields(fields, modelClass, (args, field, propName, columnName) => {
      args[propName + postfix] = {
        type: GraphQLBoolean,

        query(query, value) {
          if (value) {
            query.whereNull(fullCol(columnName, modelClass));
          } else {
            query.whereNotNull(fullCol(columnName, modelClass));
          }
        }
      };

      return args;
    });
  };
}

function likeNoCase(postfix) {
  return (fields, modelClass) => {
    return reducePrimitiveFields(fields, modelClass, (args, field, propName, columnName) => {
      args[propName + postfix] = {
        type: field.type,

        query(query, value) {
          query.whereRaw('lower(??.??) like ?', [modelClass.tableName, columnName, value.toLowerCase()]);
        }
      };

      return args;
    });
  };
}

function whereIn(method, postfix) {
  return (fields, modelClass) => {
    return reducePrimitiveFields(fields, modelClass, (args, field, propName, columnName) => {
      args[propName + postfix] = {
        type: new GraphQLList(field.type),

        query(query, value) {
          query[method](fullCol(columnName, modelClass), value);
        }
      };

      return args;
    });
  };
}

function orderBy(argName, direction, typeCache) {
  return (fields, modelClass) => {
    const args = {};
    const modelClassTypeName = utils.typeNameForModel(modelClass);
    const typeName = modelClassTypeName + 'PropertiesEnum';

    if (!typeCache[typeName]) {
      typeCache[typeName] = new GraphQLEnumType({
        name: typeName,
        values: reducePrimitiveFields(fields, modelClass, (values, field, propName, columnName) => {
          values[propName] = {value: fullCol(columnName, modelClass)};
          return values;
        })
      });
    }

    args[argName] = {
      type: typeCache[typeName],

      query(query, value) {
        query.orderBy(typeCache[typeName].parseValue(value), direction);
      }
    };

    return args;
  };
}

function range(argName) {
  return () => {
    const args = {};

    args[argName] = {
      type: new GraphQLList(GraphQLInt),

      query(query, values) {
        const start = parseInt(values[0]);
        const end = parseInt(values[1]);
        query.offset(start).limit(end - start + 1);
      }
    };

    return args;
  };
}

function reducePrimitiveFields(fields, modelClass, func) {
  const propNames = Object.keys(fields);
  let output = {};

  for (var i = 0, l = propNames.length; i < l; ++i) {
    const propName = propNames[i];
    const field = fields[propName];

    if (field.type instanceof GraphQLObjectType || field.type instanceof GraphQLList) {
      continue;
    }

    output = func(output, field, propName, modelClass.propertyNameToColumnName(propName));
  }

  return output;
}

function fullCol(columnName, modelClass) {
  return modelClass.tableName + '.' + columnName;
}
