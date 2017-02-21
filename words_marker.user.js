// ==UserScript==
// @name        words marker
// @namespace   x
// @include     https://toster.ru/q/397638*
// @include     *
// @version     1.02
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_addStyle
// @grant       GM_getResourceText
// @grant       GM_xmlhttpRequest
// @require     https://cdnjs.cloudflare.com/ajax/libs/jquery/3.1.1/jquery.min.js
// ==/UserScript==
//
/* jshint -W097 */
/* jshint -W035 */
/* globals $, console, GM_addStyle, GM_getResourceText, GM_getValue, GM_setValue, GM_xmlhttpRequest */
//
'use strict';
//
$(function () {
    //
    const STYLE = 'background-color: yellow';
    //
    const words = JSON.parse(GM_getValue('words', '{}'));
    //
    function processWordAt(x, y) {
        let node, offset;

        if (document.caretPositionFromPoint) {
            const position = document.caretPositionFromPoint(x, y);
            node = position.offsetNode;
            offset = position.offset;
        } else if (document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(x, y);
            node = range.startContainer;
            offset = range.startOffset;
        }
        if (node && node.nodeType === Node.TEXT_NODE && node.textContent) {
            const word_removed = try_remove_word(node);
            if (word_removed) {
                return word_removed;
            } else {
                const text = node.textContent;
                const length_before = text.slice(0, offset).match(/([A-Za-z]*)$/)[1].length;
                const length_after = text.slice(offset).match(/^([A-Za-z]*)/)[1].length;
                if (length_before + length_after > 0) {
                    const [_1, new_node, _2] = mark_word(node, offset - length_before, offset + length_after);
                    return new_node.textContent;
                }
            }
        }
    }

    //
    function try_remove_word(node) {
        const $marked_word = $(node).parent('._highlighted');
        const original_word = $marked_word.data('original_word');
        if ($marked_word.length) { // removing word
            const word = original_word.toLowerCase();
            $marked_word
                .text(original_word)
                .contents()
                .unwrap()[0].normalize();
            delete words[word];
            GM_setValue('words', JSON.stringify(words));
            console.log('Word removed: \"' + word + '\"');
            return word;
        }
    }

    //
    function mark_word(source_node, begin, end) {
        const text = source_node.textContent;
        /* jshint -W014 */
        const tail_node = end < text.length
            ? source_node.splitText(end)
            : undefined;
        const [forward_node, new_node] = (begin > 0)
            ? [source_node, source_node.splitText(begin)]
            : [undefined, source_node];
        const original_word = new_node.textContent;
        const word = original_word.toLowerCase();
        const $wrapped_node = $(new_node)
            .wrap('<span class="_highlighted" style="' + STYLE + '">')
            .parent()
            .data('original_word', original_word);
        const ru_0 = words[word];
        if (ru_0) {
            $wrapped_node.text(ru_0);
        } else {
            GM_xmlhttpRequest({
                method: 'method',
                url: 'http://mymemory.translated.net/api/get?langpair=en|ru&q=' + encodeURIComponent(word),
                onload: function (response) {
                    const _parse = (text) => {
                        try {
                            return JSON.parse(text);
                        } catch (e) {
                        }
                    };
                    const response_json = _parse(response.responseText);
                    if (response_json && response_json.responseData && response_json.responseData.translatedText) {
                        const ru_1 = response_json.responseData.translatedText;
                        $wrapped_node.text(ru_1);
                        words[word] = ru_1;
                        GM_setValue('words', JSON.stringify(words));
                        console.log('Word marked and appended to dictionary: \"' + word + '\" : \"' + ru_1 + '\"');
                    } else {
                        console.log('XHR JSON Error', response);
                    }
                },
                onerror: function (xhr, textStatus, errorThrown) {
                    console.log('XHR Error', xhr, textStatus, errorThrown);
                }
            });
        }
        return [forward_node, new_node, tail_node];
    }

    //
    function search_in(node) {
        const text = node.textContent;
        if (text) {
            const re = /[A-Za-z]+/g;
            for (let match = re.exec(text); match !== null; match = re.exec(text)) {
                const word = match[0].toLowerCase();
                if (words[word]) {
                    const [_1, _2, tail_node] = mark_word(node, match.index, re.lastIndex);
                    return tail_node ? search_in(tail_node) + 1 : 1;
                }
            }
        }
        return 0;
    }

    //
    $(document).click(function (event) {
        if (event.which === 1 && event.ctrlKey) {
            const word = processWordAt(event.clientX, event.clientY);
            // console.log('Word under cursor: ', word);
            if (word) {
                return false;
            }
        }
    });
    //
    const t1 = Date.now();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        nodes.push(node);
    }
    for (let i = nodes.length - 1; i--;) {
        search_in(nodes[i]);
    }
    console.log('DOM traverse done in ' + (Date.now() - t1) + ' milliseconds');
});
