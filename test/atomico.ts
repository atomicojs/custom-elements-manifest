import { c, html } from "atomico";

/**
 * Description of my component
 * @cssprop {color} --text-color - description of my custom property
 */
function component({}) {
    return html`<host />`;
}

component.props = {
    /**
     * description of my prop
     */
    age: Number,
    /**
     * description of my prop
     */
    value: {
        type: Array,
        /**
         * description of my event
         */
        event: {
            type: "MyEvent",
        },
    },
};

export const Component = c(component);

customElements.define("my-wc", Component);
