import { parseComment } from "@uppercod/jsdoc";

const getComment = (jsDoc) => jsDoc?.find(({ comment }) => comment)?.comment;

export default () => ({
    analyzePhase({ ts, node, context }) {
        switch (node.kind) {
            /**
             * Analyze if the module imports `atomico` and destroy the function `c`
             * in order to determine what is a document created for Atomico
             */
            case ts.SyntaxKind.ImportDeclaration:
                {
                    if (
                        context.imports.some(
                            (imp) =>
                                imp.importPath == "atomico" && imp.name == "c"
                        )
                    ) {
                        context.isAtomico = true;
                        context.components = {};
                    }
                }
                break;
            /**
             * Capture all function declarations
             * and extract your jsDoc
             */
            case ts.SyntaxKind.FunctionDeclaration:
                {
                    if (!context.isAtomico) break;
                    const fnName = node?.name?.escapedText;
                    context.components[fnName] = {
                        jsDoc: node?.jsDoc
                            ?.map(({ tags, comment }) => [
                                { comment },
                                ...tags.map(
                                    ({
                                        tagName: { escapedText: tag },
                                        comment,
                                    }) => ({
                                        tag,
                                        comment,
                                    })
                                ),
                            ])
                            .flat(),
                    };
                }
                break;
            /**
             *  Evaluate which functions of the captured ones use the function `c` of `Atomico`.
             */
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
            /**
             * Look for functions that declare the props object.
             */
            case ts.SyntaxKind.ObjectLiteralExpression:
                {
                    if (!context.isAtomico) break;
                    const parentFnName =
                        node.parent?.left?.expression?.escapedText;
                    const textProps = node.parent?.left?.name?.escapedText;

                    if (
                        textProps == "props" &&
                        context.components[parentFnName]
                    ) {
                        context.components[parentFnName].props =
                            node.properties.map(
                                ({
                                    name: { escapedText: prop },
                                    initializer: {
                                        escapedText: type,
                                        properties,
                                    },
                                    jsDoc,
                                }) => [
                                    prop,
                                    type
                                        ? {
                                              type,
                                              description: getComment(jsDoc),
                                          }
                                        : properties?.reduce(
                                              (
                                                  schema,
                                                  {
                                                      name: {
                                                          escapedText: prop,
                                                      },
                                                      initializer: {
                                                          escapedText: type,
                                                          properties,
                                                      },
                                                      jsDoc,
                                                  }
                                              ) => {
                                                  switch (prop) {
                                                      case "type":
                                                      case "value":
                                                      case "attr":
                                                          schema[prop] = type;
                                                          break;
                                                      case "event":
                                                          schema[prop] =
                                                              properties.reduce(
                                                                  (
                                                                      schema,
                                                                      {
                                                                          name: {
                                                                              escapedText:
                                                                                  prop,
                                                                          },
                                                                          initializer:
                                                                              {
                                                                                  text: type,
                                                                              },
                                                                      }
                                                                  ) => {
                                                                      switch (
                                                                          prop
                                                                      ) {
                                                                          case "type":
                                                                          case "base":
                                                                              schema[
                                                                                  prop
                                                                              ] =
                                                                                  type;
                                                                              break;
                                                                      }
                                                                      return schema;
                                                                  },
                                                                  {
                                                                      base: "CustomEvent",
                                                                      description:
                                                                          getComment(
                                                                              jsDoc
                                                                          ),
                                                                  }
                                                              );
                                                          break;
                                                  }
                                                  return schema;
                                              },
                                              {
                                                  description:
                                                      getComment(jsDoc),
                                              }
                                          ),
                                ]
                            );
                    }
                }
                break;
        }
    },
    /**
     *  Once analyzed, the module creates the metadata captured from the document through the context
     */
    moduleLinkPhase({ moduleDoc, context: { isAtomico, components } }) {
        if (!isAtomico) return;
        // context.components
        moduleDoc.declarations = moduleDoc.declarations.map((ref) => {
            for (let prop in components) {
                const schema = components[prop];
                if (ref.name == schema.constructor) {
                    const declarations = {
                        slots: [],
                        events: [],
                        members: [],
                        cssParts: [],
                        attributes: [],
                        cssProperties: [],
                    };
                    if (schema.jsDoc) {
                        /**
                         * Apply an analysis on the jsDoc associated with the function,
                         * this analysis is limited to switch tags.
                         */
                        schema.jsDoc
                            .filter(({ tag }) => tag)
                            .map(({ tag, comment }) =>
                                parseComment(`@${tag} ${comment}`)
                            )
                            .flat()
                            .forEach(({ tag, type: text, name, children }) => {
                                const type = { text };
                                const description = children?.join("\n");
                                const generic = {
                                    type,
                                    description,
                                    name,
                                };
                                switch (tag) {
                                    case "cssprop":
                                    case "cssproperty":
                                        declarations.cssProperties.push(
                                            generic
                                        );
                                        break;
                                    case "fires":
                                    case "event":
                                        declarations.events.push(generic);
                                        break;
                                    case "slot":
                                        declarations.slot.push(generic);
                                        break;
                                    case "csspart":
                                        declarations.cssParts.push(generic);
                                        break;
                                }
                            });
                    }
                    /**
                     * Use the object props of the functions to complete the declarations
                     */
                    schema?.props
                        ?.filter(([, schema]) => schema)
                        .forEach(([name, schema]) => {
                            const type = {
                                text: schema?.type?.toLowerCase(),
                            };
                            const { description } = schema;

                            declarations.members.push({
                                name,
                                type,
                                description,
                            });

                            declarations.attributes.push({
                                name:
                                    schema.attr ||
                                    name
                                        .replace(/([A-Z])/g, "-$1")
                                        .toLowerCase(),
                                type,
                                description,
                            });

                            if (schema.event) {
                                declarations.events.push({
                                    name: schema.event.type,
                                    type: {
                                        text: schema.event.base,
                                    },
                                    description: schema.event.description,
                                });
                            }
                        });
                    return declarations;
                }
            }
        });
    },
});
