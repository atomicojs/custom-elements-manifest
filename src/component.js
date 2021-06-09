import { c, html } from "atomico";

/**
 *
 * @cssprop --text-color - 1 bla bla...
 */
function component() {
  return html`<host />`;
}

component.props = {
  /**
   * 2 bla bla...
   */
  age: Number,
  value: {
    type: Array,
    event: {
      type: "Remo",
    },
  },
};

export const Component = c(component);

customElements.define("my-wc", Component);
