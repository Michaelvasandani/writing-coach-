import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Suggestion } from "@/lib/types";

const coachingKey = new PluginKey<DecorationSet>("coaching-suggestions");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    coachingSuggestions: { setCoachingSuggestions: (suggestions: Suggestion[]) => ReturnType };
  }
}

function buildDecorations(doc: Parameters<typeof DecorationSet.create>[0], suggestions: Suggestion[]) {
  const positions = new Map<string, number>();
  doc.descendants((node, pos) => {
    if (node.attrs.id) positions.set(node.attrs.id, pos + 1);
  });
  const decorations = suggestions.flatMap((suggestion) => suggestion.anchors.flatMap((anchor) => {
    const start = positions.get(anchor.blockId);
    if (start === undefined) return [];
    return [Decoration.inline(start + anchor.from, start + anchor.to, {
      class: `coaching-mark coaching-mark--${suggestion.category}`,
      "data-suggestion-id": suggestion.id
    })];
  }));
  return DecorationSet.create(doc, decorations);
}

export const CoachingExtension = Extension.create({
  name: "coachingSuggestions",
  addCommands() {
    return {
      setCoachingSuggestions: (suggestions) => ({ tr, dispatch }) => {
        if (dispatch) dispatch(tr.setMeta(coachingKey, suggestions));
        return true;
      }
    };
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      key: coachingKey,
      state: {
        init: () => DecorationSet.empty,
        apply(tr, current) {
          const suggestions = tr.getMeta(coachingKey) as Suggestion[] | undefined;
          if (suggestions) return buildDecorations(tr.doc, suggestions);
          return tr.docChanged ? current.map(tr.mapping, tr.doc) : current;
        }
      },
      props: { decorations: (state) => coachingKey.getState(state) }
    })];
  }
});
