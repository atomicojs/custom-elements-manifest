import {} from "@custom-elements-manifest/analyzer";

export default function myPlugin() {
  // Write a custom plugin
  return {
    // Runs for all modules in a project, before continuing to the analyzePhase
    collectPhase({ ts, node, context }) {},
    // Runs for each module
    analyzePhase({ ts, node, moduleDoc, context }) {
      switch (node.kind) {
        case ts.SyntaxKind.ImportDeclaration:
          {
            const text = node?.moduleSpecifier?.text;
            const isAtomico = node?.importClause?.namedBindings?.elements.some(
              ({ name: { escapedText } }) => escapedText == "c"
            );
            if (text == "atomico" && isAtomico) {
              context.isAtomico = true;
              context.components = {};
            }
          }
          break;
        case ts.SyntaxKind.FunctionDeclaration:
          {
            const fnName = node?.name?.escapedText;
            context.components[fnName] = {};
          }
          break;

        case ts.SyntaxKind.CallExpression:
          {
            if (!context.isAtomico) break;
            const callC = node.expression.escapedText;
            const elementName = node.parent?.name?.escapedText;
            const fnName = node.arguments?.[0]?.escapedText;
            if (callC == "c" && context.components[fnName]) {
              context.components[fnName].constructor = elementName;
            }
          }
          break;
        case ts.SyntaxKind.ObjectLiteralExpression:
          {
            if (!context.isAtomico) break;
            const parentFnName = node.parent?.left?.expression?.escapedText;
            const textProps = node.parent?.left?.name?.escapedText;

            if (textProps == "props" && context.components[parentFnName]) {
              context.components[parentFnName].props = node.properties.map(
                ({
                  name: { escapedText: prop },
                  initializer: { escapedText: type, properties },
                }) => [
                  prop,
                  type
                    ? { type }
                    : properties.reduce(
                        (
                          schema,
                          {
                            name: { escapedText: prop },
                            initializer: { escapedText: type, properties },
                          }
                        ) => {
                          switch (prop) {
                            case "type":
                            case "value":
                            case "attr":
                              schema[prop] = type;
                              break;
                            case "event":
                              schema[prop] = properties.reduce(
                                (
                                  schema,
                                  {
                                    name: { escapedText: prop },
                                    initializer: { text: type },
                                  }
                                ) => {
                                  switch (prop) {
                                    case "type":
                                    case "base":
                                      schema[prop] = type;
                                      break;
                                  }
                                  return schema;
                                },
                                {
                                  base: "CustomEvent",
                                }
                              );
                              break;
                          }
                          return schema;
                        },
                        {}
                      ),
                ]
              );
            }
          }
          break;
      }
    },
    // Runs for each module, after analyzing, all information about your module should now be available
    moduleLinkPhase({ moduleDoc, context: { isAtomico, components }, ...a }) {
      if (!isAtomico) return;

      // context.components
      moduleDoc.declarations = moduleDoc.declarations.map((ref) => {
        for (let prop in components) {
          const schema = components[prop];
          if (ref.name == schema.constructor) {
            const events = [];
            return schema.props.reduce(
              (meta, [name, schema]) => {
                const type = {
                  text: schema.type.toLowerCase(),
                };
                meta.members.push({
                  name,
                  type,
                });
                meta.attributes.push({
                  name:
                    schema.attr ||
                    name.replace(/([A-Z])/g, "-$1").toLowerCase(),
                  type,
                });
                if (schema.event) {
                  meta.events.push({
                    name: schema.event.type,
                    type: {
                      text: schema.event.base,
                    },
                  });
                }
                return meta;
              },
              {
                members: [],
                events: [],
                attributes: [],
              }
            );
          }
        }
      });
    },
  };
}
