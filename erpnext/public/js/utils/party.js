// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt

frappe.provide("erpnext.utils");
frappe.provide('erpnext.party');
erpnext.utils.get_party_details = function(frm, method, args, callback) {
	if(!method) {
		method = "erpnext.accounts.party.get_party_details";
	}
	if(!args) {
		if(frm.doctype != "Purchase Order" && frm.doc.customer) {
			args = {
				party: frm.doc.customer,
				party_type: "Customer",
				price_list: frm.doc.selling_price_list
			};
		} else if(frm.doc.supplier) {
			args = {
				party: frm.doc.supplier,
				party_type: "Supplier",
				price_list: frm.doc.buying_price_list
			};
		}

		if (args) {
			args.posting_date = frm.doc.posting_date || frm.doc.transaction_date;
		}
	}
	if(!args) return;

	if(frappe.meta.get_docfield(frm.doc.doctype, "taxes")) {
		if(!erpnext.utils.validate_mandatory(frm, "Posting/Transaction Date",
			args.posting_date, args.party_type=="Customer" ? "customer": "supplier")) return;
	}

	args.currency = frm.doc.currency;
	args.company = frm.doc.company;
	args.doctype = frm.doc.doctype;
	frappe.call({
		method: method,
		args: args,
		callback: function(r) {
			if(r.message) {
				frm.updating_party_details = true;
				frm.set_value(r.message);
				frm.updating_party_details = false;
				if(callback) callback();
			}
		}
	});
}

erpnext.utils.get_address_display = function(frm, address_field, display_field, is_your_company_address) {
	if(frm.updating_party_details) return;

	if(!address_field) {
		if(frm.doctype != "Purchase Order" && frm.doc.customer) {
			address_field = "customer_address";
		} else if(frm.doc.supplier) {
			address_field = "supplier_address";
		} else return;
	}

	if(!display_field) display_field = "address_display";
	if(frm.doc[address_field]) {
		frappe.call({
			method: "erpnext.utilities.doctype.address.address.get_address_display",
			args: {"address_dict": frm.doc[address_field] },
			callback: function(r) {
				if(r.message) {
					frm.set_value(display_field, r.message)
				}

				if(frappe.meta.get_docfield(frm.doc.doctype, "taxes") && !is_your_company_address) {
					if(!erpnext.utils.validate_mandatory(frm, "Customer/Supplier",
						frm.doc.customer || frm.doc.supplier, address_field)) return;

					if(!erpnext.utils.validate_mandatory(frm, "Posting/Transaction Date",
						frm.doc.posting_date || frm.doc.transaction_date, address_field)) return;
				} else return;

				frappe.call({
					method: "erpnext.accounts.party.set_taxes",
					args: {
						"party": frm.doc.customer || frm.doc.supplier,
						"party_type": (frm.doc.customer ? "Customer" : "Supplier"),
						"posting_date": frm.doc.posting_date || frm.doc.transaction_date,
						"company": frm.doc.company,
						"billing_address": ((frm.doc.customer) ? (frm.doc.customer_address) : (frm.doc.supplier_address)),
						"shipping_address": frm.doc.shipping_address_name
					},
					callback: function(r) {
						if(r.message){
							frm.set_value("taxes_and_charges", r.message)
						}
					}
				});
			}
		})
	} else {
		frm.set_value(display_field, null);
	}

}

erpnext.utils.get_contact_details = function(frm) {
	if(frm.updating_party_details) return;

	if(frm.doc["contact_person"]) {
		frappe.call({
			method: "erpnext.utilities.doctype.contact.contact.get_contact_details",
			args: {contact: frm.doc.contact_person },
			callback: function(r) {
				if(r.message)
					frm.set_value(r.message);
			}
		})
	}
}

erpnext.utils.validate_mandatory = function(frm, label, value, trigger_on) {
	if(!value) {
		frm.doc[trigger_on] = "";
		refresh_field(trigger_on);
		frappe.msgprint(__("Please enter {0} first", [label]));
		return false;
	}
	return true;
}

erpnext.utils.get_shipping_address = function(frm){
	frappe.call({
		method: "erpnext.utilities.doctype.address.address.get_shipping_address",
		args: {company: frm.doc.company},
		callback: function(r){
			if(r.message){
				frm.set_value("shipping_address", r.message[0]) //Address title or name
				frm.set_value("shipping_address_display", r.message[1]) //Address to be displayed on the page
			}
		}
	});
}

erpnext.party.setup_dashboard = function(frm) {
	frm.dashboard.reset(frm.doc);
	if(frm.doc.__islocal)
		return;

	$.each(frm.doc.__onload.transactions, function(i, doctype) {
		frm.dashboard.add_doctype_badge(doctype, frm.doc.doctype.toLowerCase());
	})

	return frappe.call({
		type: "GET",
		method: "erpnext.accounts.party_status.get_transaction_info",
		args: {
			party_type: frm.doc.doctype,
			party_name: frm.doc.name
		},
		callback: function(r) {
			$.each(r.message.transaction_count, function(i, d) {
				if(d.count) {
					frm.dashboard.set_badge_count(d.name, d.count)
				}
			})
		}
	});

}
