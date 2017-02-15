// ==UserScript==
// @name        words marker
// @namespace   x
// @include     https://toster.ru/q/397638*
// @version     1
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_addStyle
// @grant       GM_getResourceText
// @require     https://cdnjs.cloudflare.com/ajax/libs/jquery/3.1.1/jquery.min.js
// ==/UserScript==
//
/* jshint -W097 */
/* globals console, GM_addStyle, GM_getResourceText, GM_getValue, GM_setValue */
//
'use strict';
//
$(function () {
    //
    const STYLE = 'background-color: yellow';
    //
    const words_set = new Set(JSON.parse(GM_getValue('word_list', '[]')));
    // console.log('words_list: ', [...words_set]);
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
        if (node && node.nodeType === Node.TEXT_NODE) {
            const word_removed = try_remove_word(node);
            if (word_removed) {
                return word_removed;
            } else {
                const text = node.textContent;
                const length_before = text.slice(0, offset).match(/([0-9A-Za-zА-Яа-яЁё]*)$/)[1].length;
                const length_after = text.slice(offset).match(/^([0-9A-Za-zА-Яа-яЁё]*)/)[1].length;
                if (length_before + length_after > 0) {
                    const [_1, new_node, _2] = mark_word(node, offset - length_before, offset + length_after, true);
                    return new_node.textContent;
                }
            }
        }
    }

    function try_remove_word(node) {
        const $marked_word = $(node).parent('._highlighted');
        if ($marked_word.length) { // removing word
            const word = node.textContent;
            $marked_word.contents().unwrap()[0].normalize();
            words_set.delete(word);
            GM_setValue('word_list', JSON.stringify([...words_set]));
            console.log('Word removed: \"' + word + '\"');
            return word;
        }
    }

    function mark_word(source_node, begin, end, do_append) {
        const text = source_node.textContent;
        /* jshint -W014 */
        const tail_node = end < text.length
            ? source_node.splitText(end)
            : undefined;
        const [forward_node, new_node] = (begin > 0)
            ? [source_node, source_node.splitText(begin)]
            : [undefined, source_node];
        $(new_node).wrap('<span class="_highlighted" style="' + STYLE + '">');
        const word = new_node.textContent;
        if (do_append) {
            words_set.add(word.toLowerCase());
            GM_setValue('word_list', JSON.stringify([...words_set]));
            console.log('Word marked and appended: \"' + word + '\"');
        } else {
            console.log('Word marked: \"' + word + '\"');
        }
        return [forward_node, new_node, tail_node];
    }

    function search_in(node) {
        const text = node.textContent;
        const re = /[0-9A-Za-zА-Яа-яЁё]+/g;
        for (let match = re.exec(text); match !== null; match = re.exec(text)) {
            const word = match[0];
            if (words_set.has(word.toLowerCase())) {
                const [_1, _2, tail_node] = mark_word(node, match.index, re.lastIndex);
                return tail_node ? search_in(tail_node) + 1 : 1;
            }
        }
        return 0;
    }

    $('div[itemprop~="text"]').mousedown(function (event) {
        if (event.which === 1) {
            const word = processWordAt(event.clientX, event.clientY);
            // console.log('Word under cursor: ', word);
            if (word !== '') {
                $(".btn_add-question").text(word);
            }
        }
    }).each(function () {
        $(this).contents().filter(function () {
            return this.nodeType === Node.TEXT_NODE;
        }).each(function () {
            const occurrences = search_in(this);
            // console.log('In ', this, ' found ', occurrences, ' occurrences');
        });
    });
});
