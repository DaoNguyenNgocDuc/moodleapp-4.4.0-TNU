// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Component, OnInit, ElementRef } from '@angular/core';
import { FormBuilder, FormControl } from '@angular/forms';
import { AddonModThrdAssign, AddonModThrdAssignProvider } from '@addons/mod/thrdassign/services/thrdassign';
import { CoreTextUtils } from '@services/utils/text';
import {
    AddonModThrdAssignFeedbackCommentsDraftData,
    AddonModThrdAssignFeedbackCommentsHandler,
    AddonModThrdAssignFeedbackCommentsPluginData,
} from '../services/handler';
import { AddonModThrdAssignFeedbackDelegate } from '@addons/mod/thrdassign/services/feedback-delegate';
import { AddonModThrdAssignOffline } from '@addons/mod/thrdassign/services/thrdassign-offline';
import { CoreUtils } from '@services/utils/utils';
import { AddonModThrdAssignFeedbackPluginBaseComponent } from '@addons/mod/thrdassign/classes/base-feedback-plugin-component';
import { ContextLevel } from '@/core/constants';
/**
 * Component to render a comments feedback plugin.
 */
@Component({
    selector: 'addon-mod-thrdassign-feedback-comments',
    templateUrl: 'addon-mod-thrdassign-feedback-comments.html',
})
export class AddonModThrdAssignFeedbackCommentsComponent extends AddonModThrdAssignFeedbackPluginBaseComponent implements OnInit {

    control?: FormControl<string>;
    component = AddonModThrdAssignProvider.COMPONENT;
    text = '';
    isSent = false;
    loaded = false;

    protected element: HTMLElement;

    constructor(
        element: ElementRef,
        protected fb: FormBuilder,
    ) {
        super();
        this.element = element.nativeElement;
    }

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        try {
            this.text = await this.getText();

            if (!this.canEdit && !this.edit) {
                // User cannot edit the comment. Show it full when clicked.
                this.element.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (this.text) {
                        // Open a new state with the text.
                        CoreTextUtils.viewText(this.plugin.name, this.text, {
                            component: this.component,
                            componentId: this.thrdassign.cmid,
                            filter: true,
                            contextLevel: ContextLevel.MODULE,
                            instanceId: this.thrdassign.cmid,
                            courseId: this.thrdassign.course,
                        });
                    }
                });
            } else if (this.edit) {
                this.control = this.fb.control(this.text, { nonNullable: true });
            }
        } finally {
            this.loaded = true;
        }
    }

    /**
     * Edit the comment.
     */
    async editComment(): Promise<void> {
        try {
            const inputData = await this.editFeedback();
            const text = AddonModThrdAssignFeedbackCommentsHandler.getTextFromInputData(this.plugin, inputData);

            // Update the text and save it as draft.
            this.isSent = false;
            this.text = this.replacePluginfileUrls(text || '');
            AddonModThrdAssignFeedbackDelegate.saveFeedbackDraft(this.thrdassign.id, this.userId, this.plugin, {
                text: text,
                format: 1,
            });
        } catch {
            // User cancelled, nothing to do.
        }
    }

    /**
     * Get the text for the plugin.
     *
     * @returns Promise resolved with the text.
     */
    protected async getText(): Promise<string> {
        // Check if the user already modified the comment.
        const draft: AddonModThrdAssignFeedbackCommentsDraftData | undefined =
            await AddonModThrdAssignFeedbackDelegate.getPluginDraftData(this.thrdassign.id, this.userId, this.plugin);

        if (draft) {
            this.isSent = false;

            return this.replacePluginfileUrls(draft.text);
        }

        // There is no draft saved. Check if we have anything offline.
        const offlineData = await CoreUtils.ignoreErrors(
            AddonModThrdAssignOffline.getSubmissionGrade(this.thrdassign.id, this.userId),
            undefined,
        );

        if (offlineData && offlineData.plugindata && offlineData.plugindata.thrdassignfeedbackcomments_editor) {
            const pluginData = <AddonModThrdAssignFeedbackCommentsPluginData>offlineData.plugindata;

            // Save offline as draft.
            this.isSent = false;
            AddonModThrdAssignFeedbackDelegate.saveFeedbackDraft(
                this.thrdassign.id,
                this.userId,
                this.plugin,
                pluginData.thrdassignfeedbackcomments_editor,
            );

            return this.replacePluginfileUrls(pluginData.thrdassignfeedbackcomments_editor.text);
        }

        // No offline data found, return online text.
        this.isSent = true;

        return AddonModThrdAssign.getSubmissionPluginText(this.plugin);
    }

    /**
     * Replace @@PLUGINFILE@@ wildcards with the real URL of embedded files.
     *
     * @param text Text to treat.
     * @returns Treated text.
     */
    replacePluginfileUrls(text: string): string {
        const files = this.plugin.fileareas && this.plugin.fileareas[0] && this.plugin.fileareas[0].files;

        return CoreTextUtils.replacePluginfileUrls(text, files || []);
    }

}
