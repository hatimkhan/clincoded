'use strict';
var React = require('react');
var _ = require('underscore');
var moment = require('moment');
var globals = require('../../globals');
var RestMixin = require('../../rest').RestMixin;
var CurationInterpretationForm = require('./shared/form').CurationInterpretationForm;

var form = require('../../../libs/bootstrap/form');

var Form = form.Form;
var FormMixin = form.FormMixin;
var Input = form.Input;
var InputMixin = form.InputMixin;

// Display the curator data of the curation data
var CurationInterpretationComputational = module.exports.CurationInterpretationComputational = React.createClass({
    mixins: [RestMixin],

    propTypes: {
        data: React.PropTypes.object, // ClinVar data payload
        interpretation: React.PropTypes.object,
        updateInterpretationObj: React.PropTypes.func,
        protocol: React.PropTypes.string
    },

    getInitialState: function() {
        return {
            clinvar_id: null,
            interpretation: this.props.interpretation
        };
    },

    componentWillReceiveProps: function(nextProps) {
        this.setState({interpretation: nextProps.interpretation});
    },

    render: function() {
        return (
            <div className="variant-interpretation computational">
                {(this.state.interpretation) ?
                <div className="row">
                    <div className="col-sm-12">
                        <CurationInterpretationForm formTitle={"Predictors Demo Criteria"} renderedFormContent={comp_crit_1}
                            evidenceType={'computational'} evidenceData={this.state.data} evidenceDataUpdated={true}
                            formDataUpdater={comp_crit_1_update} variantUuid={this.props.data['@id']} criteria={['xbox1', 'xbox2']}
                            interpretation={this.state.interpretation} updateInterpretationObj={this.props.updateInterpretationObj} />
                    </div>
                </div>
                : null}

                <ul className="section-calculator clearfix">
                    <li className="col-xs-12 gutter-exc">
                        <div>
                            <h4>Pathogenicity Calculator</h4>
                            <div>Calculator placeholder</div>
                        </div>
                    </li>
                </ul>
            </div>
        );
    }
});

// FIXME: all functions below here are examples; references to these in above render() should also be removed
var comp_crit_1 = function() {
    return (
        <div>
            <Input type="checkbox" ref="xbox1-value" label="Predictors Demo Criteria 1?:" handleChange={this.handleCheckboxChange}
                checked={this.state.checkboxes['xbox1-value'] ? this.state.checkboxes['xbox1-value'] : false}
                labelClassName="col-sm-5 control-label" wrapperClassName="col-sm-7" groupClassName="form-group" />
            <Input type="checkbox" ref="xbox2-value" label="Predictors Demo Criteria 2?:" handleChange={this.handleCheckboxChange}
                checked={this.state.checkboxes['xbox2-value'] ? this.state.checkboxes['xbox1-value'] : false}
                labelClassName="col-sm-5 control-label" wrapperClassName="col-sm-7" groupClassName="form-group" />
        </div>
    );
};

var comp_crit_1_update = function(nextProps) {
    if (nextProps.interpretation) {
        if (nextProps.interpretation.evaluations && nextProps.interpretation.evaluations.length > 0) {
            nextProps.interpretation.evaluations.map(evaluation => {
                if (evaluation.criteria == 'xbox1') {
                    let tempCheckboxes = this.state.checkboxes;
                    tempCheckboxes['xbox1-value'] = evaluation.value === 'true';
                    this.setState({checkboxes: tempCheckboxes});
                }
                if (evaluation.criteria == 'xbox2') {
                    let tempCheckboxes = this.state.checkboxes;
                    tempCheckboxes['xbox2-value'] = evaluation.value === 'true';
                    this.setState({checkboxes: tempCheckboxes});
                }
            });
        }
    }
};

var pop_crit_2 = function() {
    return (
        <div>
            <Input type="select" ref="ps4-value" label="Population Demo Criteria 2?" defaultValue="No Selection"
                labelClassName="col-sm-5 control-label" wrapperClassName="col-sm-7" groupClassName="form-group">
                <option value="No Selection">No Selection</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="In Progress">In Progress</option>
            </Input>
            <Input type="text" ref="ps4-description" label="Population Demo Criteria 2 Description:" rows="5" placeholder="e.g. free text" inputDisabled={true}
                labelClassName="col-sm-5 control-label" wrapperClassName="col-sm-7" groupClassName="form-group" />
            <Input type="select" ref="ps5-value" label="Population Demo Criteria 3?" defaultValue="No Selection"
                labelClassName="col-sm-5 control-label" wrapperClassName="col-sm-7" groupClassName="form-group">
                <option value="No Selection">No Selection</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="In Progress">In Progress</option>
            </Input>
        </div>
    );
};

var pop_crit_2_update = function(nextProps) {
    if (nextProps.interpretation) {
        if (nextProps.interpretation.evaluations && nextProps.interpretation.evaluations.length > 0) {
            nextProps.interpretation.evaluations.map(evaluation => {
                switch(evaluation.criteria) {
                    case 'ps4':
                        this.refs['ps4-value'].setValue(evaluation.value);
                        this.setState({submitDisabled: false});
                        break;
                    case 'ps5':
                        this.refs['ps5-value'].setValue(evaluation.value);
                        this.setState({submitDisabled: false});
                        break;
                }
            });
        }
    }
    if (nextProps.extraData) {
        this.refs['ps4-description'].setValue(nextProps.extraData.test2);
    }
};
