'use strict';
var React = require('react');
var _ = require('underscore');
var moment = require('moment');
var form = require('../../../../libs/bootstrap/form');
var RestMixin = require('../../../rest').RestMixin;
var curator = require('../../../curator');
var PmidSummary = curator.PmidSummary;
var CuratorHistory = require('../../../curator_history');
var add_external_resource = require('../../../add_external_resource');
var AddResourceId = add_external_resource.AddResourceId;

var Form = form.Form;
var FormMixin = form.FormMixin;
var Input = form.Input;
var InputMixin = form.InputMixin;

// Class to render the extra evidence table in VCI, and handle any interactions with it
var ExtraEvidenceTable = module.exports.ExtraEvidenceTable = React.createClass({
    mixins: [RestMixin, FormMixin, CuratorHistory],

    propTypes: {
        category: React.PropTypes.string, // category (usually the tab) the evidence is part of
        subcategory: React.PropTypes.string, // subcategory (usually the panel) the evidence is part of
        href_url: React.PropTypes.object, // href_url object
        interpretation: React.PropTypes.object, // parent interpretation object
        updateInterpretationObj: React.PropTypes.func // function from index.js; this function will pass the updated interpretation object back to index.js
    },

    contextTypes: {
        fetch: React.PropTypes.func // Function to perform a search
    },

    getInitialState: function() {
        return {
            submitBusy: false, // spinner for Save button
            editBusy: false, // spinner for Edit button
            deleteBusy: false, // spinner for Delete button
            updateMsg: null,
            tempEvidence: null, // evidence object brought in my AddResourceId modal
            editEvidenceId: null, // the ID of the evidence to be edited from the table
            descriptionInput: null, // state to store the description input content
            editDescriptionInput: null, // state to store the edit description input content
            interpretation: this.props.interpretation // parent interpretation object
        };
    },

    componentWillReceiveProps: function(nextProps) {
        // Update interpretation object when received
        if (nextProps.interpretation) {
            this.setState({interpretation: nextProps.interpretation});
        }
    },

    updateTempEvidence: function(article) {
        // Called by AddResourceId modal upon closing modal. Updates the tempEvidence state and clears description input
        this.setState({tempEvidence: article, descriptionInput: null});
    },

    submitForm: function(e) {
        // Called when Add PMID form is submitted
        e.preventDefault(); e.stopPropagation(); // Don't run through HTML submit handler
        this.setState({submitBusy: true, updateMsg: null}); // Save button pressed; disable it and start spinner

        // Save all form values from the DOM.
        this.saveAllFormValues();

        let flatInterpretation = null;
        let freshInterpretation = null;

        this.getRestData('/interpretation/' + this.state.interpretation.uuid).then(interpretation => {
            // get updated interpretation object, then flatten it
            freshInterpretation = interpretation;
            flatInterpretation = curator.flatten(freshInterpretation);

            // create extra_evidence object to be inserted
            let extra_evidence = {
                variant: this.state.interpretation.variant['@id'],
                category: this.props.category,
                subcategory: this.props.subcategory,
                articles: [this.state.tempEvidence.pmid],
                description: this.refs['description'].getValue()
            };

            return this.postRestData('/extra-evidence/', extra_evidence).then(result => {
                // post the new extra evidence object, then add its @id to the interpretation's extra_evidence_list array
                if (!flatInterpretation.extra_evidence_list) {
                    flatInterpretation.extra_evidence_list = [];
                }
                flatInterpretation.extra_evidence_list.push(result['@graph'][0]['@id']);

                // update interpretation object
                return this.putRestData('/interpretation/' + this.state.interpretation.uuid, flatInterpretation).then(data => {
                    return Promise.resolve(data['@graph'][0]);
                });
            });
        }).then(interpretation => {
            // upon successful save, set everything to default state, and trigger updateInterptationObj callback
            this.setState({submitBusy: false, tempEvidence: null, descriptionInput: null});
            this.props.updateInterpretationObj();
        }).catch(error => {
            this.setState({submitBusy: false, tempEvidence: null, updateMsg: <span className="text-danger">Something went wrong while trying to save this evidence!</span>});
            console.log(error);
        });
    },

    cancelAddEvidenceButton: function(e) {
        // called when the Cancel button is pressed during Add PMID
        e.preventDefault(); e.stopPropagation(); // Don't run through HTML submit handler
        this.setState({tempEvidence: null, descriptionInput: null});
    },

    editEvidenceButton: function(index) {
        // called when the Edit button is pressed for an existing evidence
        this.setState({editEvidenceId: index, editDescriptionInput: null});
    },

    cancelEditEvidenceButton: function(e) {
        // called when the Cancel button is pressed while editing an existing evidence
        e.preventDefault(); e.stopPropagation(); // Don't run through HTML submit handler
        this.setState({editEvidenceId: null, editDescriptionInput: null});
    },

    submitEditForm: function(e) {
        // called when Edit PMID form is submitted
        e.preventDefault(); e.stopPropagation(); // Don't run through HTML submit handler
        this.setState({editBusy: true, updateMsg: null}); // Save button pressed; disable it and start spinner

        // Save all form values from the DOM.
        this.saveAllFormValues();

        // since the extra_evidence object is really simple, and the description is the only thing changing,
        // make a new one instead of getting an updated and flattened one
        let extra_evidence = {
            variant: this.state.interpretation.variant['@id'],
            category: this.props.category,
            subcategory: this.props.subcategory,
            articles: [this.refs['edit-pmid'].getValue()],
            description: this.refs['edit-description'].getValue()
        };

        this.putRestData(this.refs['edit-target'].getValue(), extra_evidence).then(result => {
            // upon successful save, set everything to default state, and trigger updateInterptationObj callback
            this.setState({editBusy: false, editEvidenceId: null, editDescriptionInput: null});
            this.props.updateInterpretationObj();
        }).catch(error => {
            this.setState({editBusy: false, editEvidenceId: null, editDescriptionInput: null});
            console.log(error);
        });
    },

    deleteEvidence: function(evidence) {
        // called when the Delete button for an existing evidence is pressed
        this.setState({deleteBusy: true});

        let deleteTargetId = evidence['@id'];
        let flatInterpretation = null;
        let freshInterpretation = null;

        // since the extra_evidence object is really simple, and the description is the only thing changing,
        // make a new one instead of getting an updated and flattened one
        let extra_evidence = {
            variant: evidence.variant,
            category: this.props.category,
            subcategory: this.props.subcategory,
            articles: [evidence.articles[0]['@id']],
            description: evidence.description,
            status: 'deleted'
        };

        this.putRestData(evidence['@id'], extra_evidence).then(result => {
            this.getRestData('/interpretation/' + this.state.interpretation.uuid).then(interpretation => {
                // get updated interpretation object, then flatten it
                freshInterpretation = interpretation;
                flatInterpretation = curator.flatten(freshInterpretation);

                // remove removed evidence from evidence list
                flatInterpretation.extra_evidence_list.splice(flatInterpretation.extra_evidence_list.indexOf(deleteTargetId), 1);

                // update the interpretation object
                return this.putRestData('/interpretation/' + this.state.interpretation.uuid, flatInterpretation).then(data => {
                    return Promise.resolve(data['@graph'][0]);
                });
            }).then(interpretation => {
                // upon successful save, set everything to default state, and trigger updateInterptationObj callback
                this.setState({deleteBusy: false});
                this.props.updateInterpretationObj();
            });
        }).catch(error => {
            this.setState({deleteBusy: false});
            console.log(error);
        });
    },

    renderInterpretationExtraEvidence: function(extra_evidence) {
        // for rendering the evidence in tabular format
        return (
            <tr key={extra_evidence.uuid}>
                <td className="col-md-5"><PmidSummary article={extra_evidence.articles[0]} pmidLinkout /></td>
                <td className="col-md-5">{extra_evidence.description}</td>
                <td className="col-md-2">
                    <button className="btn btn-default btn-inline-spacer" onClick={() => this.editEvidenceButton(extra_evidence.articles[0].pmid)}>Edit</button>
                    <Input type="button-button" inputClassName="btn btn-danger btn-inline-spacer" title="Delete" submitBusy={this.state.deleteBusy}
                        clickHandler={() => this.deleteEvidence(extra_evidence)} />
                </td>
            </tr>
        );
    },

    handleDescriptionChange: function(ref, e) {
        // handles updating the state on textbox input change
        if (ref === 'description') {
            this.setState({descriptionInput: this.refs[ref].getValue()});
        } else if (ref === 'edit-description') {
            this.setState({editDescriptionInput: this.refs[ref].getValue()});
        }

    },

    renderInterpretationExtraEvidenceEdit: function(extra_evidence) {
        return (
            <tr key={extra_evidence.uuid}>
                <td colSpan="3">
                    <PmidSummary article={extra_evidence.articles[0]} className="alert alert-info" pmidLinkout />
                    <Form submitHandler={this.submitEditForm} formClassName="form-horizontal form-std">
                        <Input type="text" ref="edit-target" value={extra_evidence['@id']} inputDisabled={true} groupClassName="hidden" />
                        <Input type="text" ref="edit-pmid" value={extra_evidence.articles[0].pmid} inputDisabled={true} groupClassName="hidden" />
                        <Input type="textarea" ref="edit-description" rows="2" label="Evidence:" value={extra_evidence.description} defaultValue={extra_evidence.description}
                            labelClassName="col-xs-2 control-label" wrapperClassName="col-xs-10" groupClassName="form-group" handleChange={this.handleDescriptionChange} />
                        <div className="clearfix">
                            <button className="btn btn-default pull-right btn-inline-spacer" onClick={this.cancelEditEvidenceButton}>Cancel Edit</button>
                            <Input type="submit" inputClassName="btn-info pull-right btn-inline-spacer" id="submit" title="Edit"
                                submitBusy={this.state.editBusy} inputDisabled={!(this.state.editDescriptionInput && this.state.editDescriptionInput.length > 0)} />
                            {this.state.updateMsg ?
                                <div className="submit-info pull-right">{this.state.updateMsg}</div>
                            : null}
                        </div>
                    </Form>
                </td>
            </tr>
        );
    },


    render: function() {
        let relevantEvidenceList = [];
        if (this.state.interpretation && this.state.interpretation.extra_evidence_list) {
            this.state.interpretation.extra_evidence_list.map(extra_evidence => {
                if (extra_evidence.subcategory === this.props.subcategory) {
                    relevantEvidenceList.push(extra_evidence);
                }
            });
        }
        let parentObj = {/*
            '@type': ['evidenceList'],
            'evidenceList': relevantEvidenceList
        */};

        return (
            <div className="panel panel-info">
                <div className="panel-heading"><h3 className="panel-title">PubMed Evidence</h3></div>
                <div className="panel-content-wrapper">
                    <table className="table">
                        {relevantEvidenceList.length > 0 ?
                            <thead>
                                <tr>
                                    <th>Article</th>
                                    <th>Evidence</th>
                                    <th></th>
                                </tr>
                            </thead>
                        : null}
                        <tbody>
                            {relevantEvidenceList.length > 0 ?
                                relevantEvidenceList.map(evidence => {
                                    return (this.state.editEvidenceId === evidence.articles[0].pmid
                                        ? this.renderInterpretationExtraEvidenceEdit(evidence)
                                        : this.renderInterpretationExtraEvidence(evidence));
                                })
                            : null}
                            <tr>
                                <td colSpan="3">
                                    {!this.state.tempEvidence ?
                                    <AddResourceId resourceType="pubmed" protocol={this.props.href_url.protocol} parentObj={parentObj} wrapperClass="pull-right" buttonClass="btn-primary"
                                        buttonText="Add PMID" modalButtonText="Add Article" updateParentForm={this.updateTempEvidence} buttonOnly={true} />
                                    : null}
                                    {this.state.tempEvidence ?
                                        <div>
                                            <PmidSummary article={this.state.tempEvidence} className="alert alert-info" pmidLinkout />

                                            <Form submitHandler={this.submitForm} formClassName="form-horizontal form-std">
                                                <Input type="textarea" ref="description" rows="2" label="Evidence:" handleChange={this.handleDescriptionChange}
                                                    labelClassName="col-xs-2 control-label" wrapperClassName="col-xs-10" groupClassName="form-group" />
                                                <div className="clearfix">
                                                    <button className="btn btn-default pull-right btn-inline-spacer" onClick={this.cancelAddEvidenceButton}>Cancel</button>
                                                    <AddResourceId resourceType="pubmed" protocol={this.props.href_url.protocol} parentObj={parentObj} wrapperClass="pull-right btn-inline-spacer" buttonClass="btn-info"
                                                        buttonText="Edit PMID" modalButtonText="Add Article" updateParentForm={this.updateTempEvidence} buttonOnly={true} />
                                                    <Input type="submit" inputClassName="btn-primary pull-right btn-inline-spacer" id="submit" title="Save"
                                                        submitBusy={this.state.submitBusy} inputDisabled={!(this.state.descriptionInput && this.state.descriptionInput.length > 0)} />
                                                    {this.state.updateMsg ?
                                                        <div className="submit-info pull-right">{this.state.updateMsg}</div>
                                                    : null}
                                                </div>
                                            </Form>
                                        </div>
                                    : null}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
});
